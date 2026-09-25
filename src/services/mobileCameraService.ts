import QRCode from 'qrcode';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseService } from './supabaseService';
import { TestPhoto } from '../types';

export interface MobileDeviceInfo {
  userAgent: string;
  platform: string;
  model?: string;
  hasTorch?: boolean;
  batteryLevel?: number;
  facingMode?: 'environment' | 'user';
}

export interface MobileCameraSession {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: 'waiting' | 'connected' | 'disconnected';
  deviceInfo?: MobileDeviceInfo;
  lastPing?: string;
  remoteCommand?: {
    type: 'shutter' | 'toggle_torch' | 'switch_camera' | 'scan_mode';
    timestamp: number;
  } | null;
  lastPhoto?: {
    id: string;
    url: string;
    category: TestPhoto['category'];
    caption: string;
    timestamp: string;
    gpsCoords?: { latitude: number; longitude: number };
    userName?: string;
  } | null;
  lastScan?: {
    code: string;
    timestamp: string;
  } | null;
  targetWizardStep?: string;
}

const SESSION_STORAGE_KEY = 'jvm_mobile_camera_session_active';
const BROADCAST_CHANNEL_NAME = 'jvm_mobile_camera_bridge';
const REALTIME_EVENT = 'session_patch';

type SessionListener = (session: MobileCameraSession) => void;

/**
 * Ponte Câmera do Celular <-> Computador.
 * Transporte entre aparelhos: Supabase Realtime (Broadcast) — substitui o
 * Firestore. As fotos são enviadas ao Supabase Storage e só a URL trafega.
 * Na mesma máquina/navegador também usa BroadcastChannel e eventos de storage.
 */
class MobileCameraService {
  private broadcastChannel: BroadcastChannel | null = null;
  private activeUnsubscribes: Map<string, () => void> = new Map();
  private realtimeChannels: Map<string, RealtimeChannel> = new Map();
  private realtimeReady: Map<string, Promise<boolean>> = new Map();
  private listeners: Map<string, Set<SessionListener>> = new Map();
  private lastCommandTs: Map<string, number> = new Map();

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      } catch (e) {
        console.warn('BroadcastChannel not supported in this environment', e);
      }
    }
  }

  /** Gera um código de sessão curto e legível (ex.: JVM-CAM-9482-K3F) */
  generateSessionId(): string {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const suffix = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `JVM-CAM-${randomNum}-${suffix}`;
  }

  getPairingUrl(sessionId: string): string {
    if (typeof window === 'undefined') return '';
    const origin = window.location.origin;
    return `${origin}/?cam=${encodeURIComponent(sessionId)}`;
  }

  async generateQRCode(sessionId: string): Promise<string> {
    const url = this.getPairingUrl(sessionId);
    try {
      return await QRCode.toDataURL(url, {
        width: 320,
        margin: 2,
        color: {
          dark: '#0A2540',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'M'
      });
    } catch (err) {
      console.error('Error generating QR code for mobile camera session:', err);
      return '';
    }
  }

  // ---------------------------------------------------------------------------
  // Estado local da sessão
  // ---------------------------------------------------------------------------
  private readLocal(sessionId: string): MobileCameraSession | null {
    try {
      const stored = localStorage.getItem(`jvm_cam_session_${sessionId}`);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  private writeLocal(session: MobileCameraSession): void {
    try {
      // comandos remotos não são persistidos (evita disparos repetidos)
      const persisted = { ...session, remoteCommand: null };
      localStorage.setItem(`jvm_cam_session_${session.id}`, JSON.stringify(persisted));
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(persisted));
    } catch {}
  }

  private mergePatch(sessionId: string, patch: Partial<MobileCameraSession>): MobileCameraSession {
    const current = this.readLocal(sessionId) || {
      id: sessionId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'waiting' as const
    };
    const merged: MobileCameraSession = { ...current, ...patch, id: sessionId };
    this.writeLocal(merged);
    return merged;
  }

  private notify(sessionId: string, session: MobileCameraSession): void {
    const cmdTs = session.remoteCommand?.timestamp;
    if (cmdTs) {
      if (this.lastCommandTs.get(sessionId) === cmdTs) {
        session = { ...session, remoteCommand: null };
      } else {
        this.lastCommandTs.set(sessionId, cmdTs);
      }
    }
    this.listeners.get(sessionId)?.forEach(fn => {
      try { fn(session); } catch (e) { console.warn('Camera listener error:', e); }
    });
  }

  // ---------------------------------------------------------------------------
  // Canal Supabase Realtime (Broadcast)
  // ---------------------------------------------------------------------------
  private ensureRealtime(sessionId: string): Promise<boolean> {
    const existing = this.realtimeReady.get(sessionId);
    if (existing) return existing;

    const ready = new Promise<boolean>((resolve) => {
      try {
        const client = SupabaseService.getClient();
        const channel = client.channel(`jvm-cam-${sessionId}`, {
          config: { broadcast: { self: false, ack: false } }
        });
        channel.on('broadcast', { event: REALTIME_EVENT }, ({ payload }) => {
          if (!payload || typeof payload !== 'object') return;
          const merged = this.mergePatch(sessionId, payload as Partial<MobileCameraSession>);
          this.notify(sessionId, { ...merged, remoteCommand: (payload as any).remoteCommand || null });
        });
        const timeout = setTimeout(() => resolve(false), 6000);
        channel.subscribe(status => {
          if (status === 'SUBSCRIBED') {
            clearTimeout(timeout);
            resolve(true);
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            clearTimeout(timeout);
            resolve(false);
          }
        });
        this.realtimeChannels.set(sessionId, channel);
      } catch (err) {
        console.info('[Câmera Remota] Supabase Realtime indisponível, usando canal local:', err);
        resolve(false);
      }
    });
    this.realtimeReady.set(sessionId, ready);
    return ready;
  }

  /** Aplica e propaga uma alteração da sessão (local + outros aparelhos). */
  private async publish(sessionId: string, patch: Partial<MobileCameraSession>, localEventType: string): Promise<boolean> {
    const merged = this.mergePatch(sessionId, patch);
    const sessionForListeners = { ...merged, remoteCommand: patch.remoteCommand || null };

    this.broadcastChannel?.postMessage({ type: localEventType, sessionId, session: sessionForListeners });

    const ok = await this.ensureRealtime(sessionId);
    const channel = this.realtimeChannels.get(sessionId);
    if (ok && channel) {
      try {
        const res = await channel.send({ type: 'broadcast', event: REALTIME_EVENT, payload: patch });
        return res === 'ok';
      } catch (err) {
        console.info('[Câmera Remota] Falha no envio via Supabase Realtime:', err);
      }
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // API pública (mesma interface usada pelas telas)
  // ---------------------------------------------------------------------------
  async createSession(targetSessionId?: string): Promise<MobileCameraSession> {
    const sessionId = targetSessionId || this.generateSessionId();
    const now = new Date().toISOString();

    const sessionData: MobileCameraSession = {
      id: sessionId,
      createdAt: now,
      updatedAt: now,
      status: 'waiting',
      remoteCommand: null,
      lastPhoto: null,
      lastScan: null
    };

    this.writeLocal(sessionData);
    this.broadcastChannel?.postMessage({ type: 'session_created', session: sessionData });
    this.ensureRealtime(sessionId).catch(() => {});
    return sessionData;
  }

  listenToSession(sessionId: string, onUpdate: (session: MobileCameraSession) => void): () => void {
    if (!this.listeners.has(sessionId)) this.listeners.set(sessionId, new Set());
    this.listeners.get(sessionId)!.add(onUpdate);

    const stored = this.readLocal(sessionId);
    if (stored) onUpdate({ ...stored, remoteCommand: null });

    const handleBroadcast = (event: MessageEvent) => {
      const session = event.data?.session;
      if (session && session.id === sessionId) {
        this.notify(sessionId, session);
      }
    };
    this.broadcastChannel?.addEventListener('message', handleBroadcast);

    const handleStorage = (event: StorageEvent) => {
      if (event.key === `jvm_cam_session_${sessionId}` && event.newValue) {
        try {
          onUpdate({ ...JSON.parse(event.newValue), remoteCommand: null });
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorage);

    this.ensureRealtime(sessionId).catch(() => {});

    const cleanup = () => {
      this.broadcastChannel?.removeEventListener('message', handleBroadcast);
      window.removeEventListener('storage', handleStorage);
      this.listeners.get(sessionId)?.delete(onUpdate);
      this.activeUnsubscribes.delete(sessionId);
    };

    this.activeUnsubscribes.set(sessionId, cleanup);
    return cleanup;
  }

  async joinSessionFromMobile(sessionId: string, deviceInfo: MobileDeviceInfo): Promise<boolean> {
    const now = new Date().toISOString();
    const patch: Partial<MobileCameraSession> = {
      status: 'connected',
      deviceInfo,
      lastPing: now,
      updatedAt: now
    };

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('jvm-mobile-camera-joined', { detail: { sessionId, deviceInfo } }));
    }
    await this.publish(sessionId, patch, 'mobile_connected');
    return true;
  }

  async sendPhotoFromMobile(
    sessionId: string,
    photo: {
      url: string;
      category: TestPhoto['category'];
      caption?: string;
      gpsCoords?: { latitude: number; longitude: number };
      userName?: string;
    }
  ): Promise<boolean> {
    const now = new Date().toISOString();

    // Foto vai para o Supabase Storage; pela ponte trafega apenas a URL.
    let url = photo.url;
    if (url && url.startsWith('data:')) {
      const uploaded = await SupabaseService.uploadEvidenceImage(url, `camera-remota/${sessionId}`);
      if (uploaded) url = uploaded;
    }

    const photoRecord = {
      id: 'photo_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      url,
      category: photo.category || 'durante',
      caption: photo.caption || 'Captura de evidência via Câmera Móvel',
      timestamp: now,
      gpsCoords: photo.gpsCoords,
      userName: photo.userName || 'Celular Remoto'
    };

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('jvm-mobile-camera-photo', { detail: { sessionId, photo: photoRecord } }));
    }
    await this.publish(sessionId, { lastPhoto: photoRecord, updatedAt: now }, 'photo_received');
    return true;
  }

  async sendScanFromMobile(sessionId: string, code: string): Promise<boolean> {
    const now = new Date().toISOString();
    const scanRecord = { code, timestamp: now };

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('jvm-mobile-camera-scan', { detail: { sessionId, scan: scanRecord } }));
    }
    await this.publish(sessionId, { lastScan: scanRecord, updatedAt: now }, 'scan_received');
    return true;
  }

  async triggerRemoteShutter(sessionId: string): Promise<void> {
    const cmd = { type: 'shutter' as const, timestamp: Date.now() };
    await this.publish(sessionId, { remoteCommand: cmd, updatedAt: new Date().toISOString() }, 'remote_command');
  }

  async pingMobileSession(sessionId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.publish(sessionId, { lastPing: now, updatedAt: now }, 'mobile_ping');
  }

  async closeSession(sessionId: string): Promise<void> {
    const cleanup = this.activeUnsubscribes.get(sessionId);
    if (cleanup) cleanup();
    this.listeners.delete(sessionId);
    this.lastCommandTs.delete(sessionId);

    try {
      localStorage.removeItem(`jvm_cam_session_${sessionId}`);
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {}

    const channel = this.realtimeChannels.get(sessionId);
    if (channel) {
      try {
        await SupabaseService.getClient().removeChannel(channel);
      } catch {}
    }
    this.realtimeChannels.delete(sessionId);
    this.realtimeReady.delete(sessionId);
  }
}

export const mobileCameraService = new MobileCameraService();
