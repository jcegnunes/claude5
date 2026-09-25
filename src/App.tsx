import { ViewErrorBoundary } from './components/ViewErrorBoundary';
import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { MobileBottomNav } from './components/MobileBottomNav';
import { QRCodeScannerModal } from './components/QRCodeScannerModal';
import { LaudoViewModal } from './components/LaudoViewModal';
import { CertificadoViewModal } from './components/CertificadoViewModal';
import { CertificateValidationView } from './components/CertificateValidationView';

// Views
import { DashboardView } from './views/DashboardView';
import { TestWizardView } from './views/TestWizardView';
import { TestsListView } from './views/TestsListView';
import { EquipmentView } from './views/EquipmentView';
import { ServiceOrdersView } from './views/ServiceOrdersView';
import { ClientsView } from './views/ClientsView';
import { LabInstrumentsView } from './views/LabInstrumentsView';
import { NormsView } from './views/NormsView';
import { SyncManagerView } from './views/SyncManagerView';
import { AuditLogsView } from './views/AuditLogsView';
import { BackupSettingsView } from './views/BackupSettingsView';
import { ReportEmissionView } from './views/ReportEmissionView';
import { AndroidFieldModeView } from './views/AndroidFieldModeView';
import { AndroidAppShell } from './components/AndroidAppShell';
import { AndroidInstallModal } from './components/AndroidInstallModal';
import { MobileCameraCompanionView } from './views/MobileCameraCompanionView';
import { MobileCameraBridgeModal } from './components/MobileCameraBridgeModal';
import { LocalDeviceFilesManagerModal } from './components/LocalDeviceFilesManagerModal';

import { User, TestRecord, Equipment } from './types';
import { DielectricStorageService } from './services/syncEngine';
import { AuthService } from './services/authService';
import { SupabaseService } from './services/supabaseService';
import { LoginView } from './views/LoginView';

export default function App() {
  // Check for Mobile Camera Companion Mode (?cam=JVM-CAM-XXXX or #cam=JVM-CAM-XXXX)
  const urlParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, '?'));
  const initialCamSession = urlParams.get('cam') || hashParams.get('cam');
  const [mobileCamSessionId, setMobileCamSessionId] = useState<string | null>(initialCamSession);

  // Check if current URL is a public validation URL like /validar/VAL-JVM-2026-A8B1C4
  const currentPath = window.location.pathname;
  const isDirectValidation = currentPath.startsWith('/validar');
  const pathValidationCode = isDirectValidation ? currentPath.split('/validar/')[1]?.split('/')[0] : '';

  // Auth & Multi-Company Login State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    if (isDirectValidation || initialCamSession) return true;
    return AuthService.isAuthenticated();
  });

  // App Navigation & User State
  const [activeView, setActiveView] = useState<string>(isDirectValidation ? 'validar' : 'dashboard');
  const [currentUser, setCurrentUser] = useState<User>(() => {
    const storedUser = AuthService.getCurrentUser();
    if (storedUser) return storedUser;
    const users = DielectricStorageService.getUsers();
    return users.find(u => u.role === 'responsavel_tecnico') || users[0];
  });

  // Offline / Online & Sync
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [syncToast, setSyncToast] = useState<{ show: boolean; message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Field / Android Mode
  const [isFieldMode, setIsFieldMode] = useState<boolean>(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState<boolean>(false);

  // Modals & Active Records
  const [isQRScannerOpen, setIsQRScannerOpen] = useState<boolean>(false);
  const [isGlobalMobileCamOpen, setIsGlobalMobileCamOpen] = useState<boolean>(false);
  const [isDeviceFilesModalOpen, setIsDeviceFilesModalOpen] = useState<boolean>(false);
  const [activeLaudoTest, setActiveLaudoTest] = useState<TestRecord | null>(null);
  const [activeCertificadoTest, setActiveCertificadoTest] = useState<TestRecord | null>(null);
  const [validationCodeForPortal, setValidationCodeForPortal] = useState<string>(pathValidationCode || '');

  // Pre-selected parameters for wizard
  const [wizardPreSelectedEqId, setWizardPreSelectedEqId] = useState<string | undefined>();
  const [wizardPreSelectedOSId, setWizardPreSelectedOSId] = useState<string | undefined>();
  const [editingTest, setEditingTest] = useState<TestRecord | null>(null);
  const [equipmentViewSelectedEq, setEquipmentViewSelectedEq] = useState<Equipment | null>(null);

  // Pre-selected parameters for report emission
  const [reportPreSelectedOSId, setReportPreSelectedOSId] = useState<string | undefined>();
  const [reportPreSelectedClientId, setReportPreSelectedClientId] = useState<string | undefined>();

  // Versão dos dados: incrementada a cada alteração local ou recebida do Supabase
  const [dataVersion, setDataVersion] = useState<number>(0);

  // Update pending queue count
  const refreshSyncCount = () => {
    const stats = DielectricStorageService.getPendingStats();
    setPendingSyncCount(stats.totalPending);
  };

  useEffect(() => {
    refreshSyncCount();

    // Sincronização automática com o Supabase (banco único): envio da fila
    // local, download incremental, Realtime e reenvio ao voltar a conexão.
    // Não roda no portal público de validação nem na câmera remota.
    if (!isDirectValidation && !initialCamSession) {
      SupabaseService.startAutoSync();
    }

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const handleDataChanged = () => {
      setDataVersion(v => v + 1);
      refreshSyncCount();
    };
    const handleAuthChanged = (e: any) => {
      if (e.detail?.user) {
        setCurrentUser(e.detail.user);
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
      setDataVersion(v => v + 1);
    };

    const handleStorageQuota = () => {
      setSyncToast({
        show: true,
        type: 'error',
        message: 'Armazenamento do aparelho cheio. Conecte-se à internet para enviar os ensaios e fotos pendentes ao Supabase.'
      });
      setTimeout(() => setSyncToast(null), 7000);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('jvm-data-changed', handleDataChanged);
    window.addEventListener('jvm-auth-changed', handleAuthChanged);
    window.addEventListener('jvm-storage-quota', handleStorageQuota);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('jvm-data-changed', handleDataChanged);
      window.removeEventListener('jvm-auth-changed', handleAuthChanged);
      window.removeEventListener('jvm-storage-quota', handleStorageQuota);
    };
  }, []);

  const handleLogout = () => {
    AuthService.logout();
    setIsAuthenticated(false);
  };

  // Trigger manual sync
  const handleTriggerSync = async () => {
    setIsSyncing(true);
    try {
      // Envia a fila local e baixa as alterações feitas em outros dispositivos
      const res = await DielectricStorageService.syncWithCentralServer(isOnline);
      refreshSyncCount();

      if (res.success) {
        setSyncToast({
          show: true,
          type: 'success',
          message: res.message || `${res.pushedCount} item(ns) sincronizado(s) com a plataforma!`
        });
      } else {
        setSyncToast({
          show: true,
          type: 'info',
          message: res.error || 'Dispositivo offline. Todos os arquivos e registros estão salvos com segurança na memória local.'
        });
      }
    } catch (err: any) {
      console.warn('Sync notice:', err);
      setSyncToast({
        show: true,
        type: 'error',
        message: 'Aviso de sincronização: dados salvos localmente no dispositivo.'
      });
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncToast(null), 5000);
    }
  };

  // Start new test helper
  const handleStartTest = (equipmentId?: string, osId?: string) => {
    setEditingTest(null);
    setWizardPreSelectedEqId(equipmentId);
    setWizardPreSelectedOSId(osId);
    setActiveView('wizard');
  };

  // Edit existing test helper
  const handleEditTest = (test: TestRecord) => {
    setEditingTest(test);
    setWizardPreSelectedEqId(test.equipmentId);
    setWizardPreSelectedOSId(test.serviceOrderId);
    setActiveView('wizard');
  };

  // Completed Test Callback from Wizard
  const handleTestFinished = (test: TestRecord) => {
    setEditingTest(null);
    refreshSyncCount();
    setActiveLaudoTest(test);
    setActiveView('tests');
  };

  // Open Report Emission with optional filters
  const handleOpenReportEmission = (osId?: string, clientId?: string) => {
    setReportPreSelectedOSId(osId);
    setReportPreSelectedClientId(clientId);
    setActiveView('reports');
  };

  // If this device was opened by scanning the remote camera QR code on a mobile phone
  if (mobileCamSessionId) {
    return (
      <MobileCameraCompanionView
        sessionId={mobileCamSessionId}
        onExit={() => {
          // Clear query params and return to regular web app
          window.history.replaceState({}, '', window.location.pathname);
          setMobileCamSessionId(null);
        }}
      />
    );
  }

  // If user is directly on public validation portal
  if (activeView === 'validar') {
    return (
      <CertificateValidationView
        initialCode={validationCodeForPortal}
        onBackToApp={() => {
          setValidationCodeForPortal('');
          setActiveView('dashboard');
          if (window.history.pushState) {
            window.history.pushState(null, '', '/');
          }
        }}
      />
    );
  }

  // If not authenticated, show Multi-User & Multi-Company Login Screen
  if (!isAuthenticated) {
    return (
      <LoginView
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setIsAuthenticated(true);
          setDataVersion(v => v + 1);
        }}
      />
    );
  }

  // If user is in Android Mode, render the full Android Application Shell
  if (isFieldMode) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-start antialiased text-slate-800">
        <AndroidAppShell
          currentUser={currentUser}
          onUserChange={setCurrentUser}
          activeView={activeView}
          onNavigate={setActiveView}
          isOnline={isOnline}
          onToggleOnline={() => setIsOnline(!isOnline)}
          pendingSyncCount={pendingSyncCount}
          onTriggerSync={handleTriggerSync}
          isSyncing={isSyncing}
          onOpenQRScanner={() => setIsQRScannerOpen(true)}
          onStartNewTest={(eqId, osId) => handleStartTest(eqId, osId)}
          onOpenLaudo={(t) => setActiveLaudoTest(t)}
          onOpenCertificado={(t) => setActiveCertificadoTest(t)}
          onSelectEquipment={(eq) => {
            setEquipmentViewSelectedEq(eq);
            setActiveView('equipment');
          }}
          onOpenInstallModal={() => setIsInstallModalOpen(true)}
          onOpenDeviceFilesModal={() => setIsDeviceFilesModalOpen(true)}
          onExitAndroidMode={() => setIsFieldMode(false)}
          onLogout={handleLogout}
        >
          {/* Main Content inside Android App Frame (100% of fields and views preserved) */}
          <ViewErrorBoundary resetKey={activeView} onGoHome={() => setActiveView('dashboard')}>
          {(activeView === 'dashboard' || activeView === 'android_home') && (
            <AndroidFieldModeView
              key={`android_dash_${dataVersion}`}
              currentUser={currentUser}
              onOpenQRScanner={() => setIsQRScannerOpen(true)}
              onStartNewTest={(eqId) => handleStartTest(eqId)}
              onNavigate={setActiveView}
              isOnline={isOnline}
              onToggleOnline={() => setIsOnline(!isOnline)}
              pendingSyncCount={pendingSyncCount}
              onTriggerSync={handleTriggerSync}
              isSyncing={isSyncing}
              onOpenTestLaudo={(t) => setActiveLaudoTest(t)}
              onOpenCertificado={(t) => setActiveCertificadoTest(t)}
              onOpenInstallModal={() => setIsInstallModalOpen(true)}
              onOpenDeviceFiles={() => setIsDeviceFilesModalOpen(true)}
            />
          )}

          {activeView === 'wizard' && (
            <TestWizardView
              key={`android_wiz_${editingTest?.id || wizardPreSelectedEqId || 'new'}_${wizardPreSelectedOSId || 'none'}`}
              currentUser={currentUser}
              onFinishTest={handleTestFinished}
              editingTest={editingTest}
              onCancelEdit={() => {
                setEditingTest(null);
                setActiveView('tests');
              }}
              preSelectedEquipmentId={wizardPreSelectedEqId}
              preSelectedOSId={wizardPreSelectedOSId}
            />
          )}

          {activeView === 'tests' && (
            <TestsListView
              key={`android_tests_${dataVersion}`}
              onOpenLaudo={(t) => setActiveLaudoTest(t)}
              onOpenCertificado={(t) => setActiveCertificadoTest(t)}
              onStartNewTest={() => handleStartTest()}
              onEditTest={handleEditTest}
              onValidateOnline={(code) => {
                setValidationCodeForPortal(code);
                setActiveView('validar');
              }}
              onOpenReportEmission={() => setActiveView('reports')}
            />
          )}

          {activeView === 'reports' && (
            <ReportEmissionView
              key={`android_reports_${dataVersion}_${reportPreSelectedOSId || 'none'}`}
              currentUser={currentUser}
              onOpenTestLaudo={(t) => setActiveLaudoTest(t)}
              preSelectedOSId={reportPreSelectedOSId}
              preSelectedClientId={reportPreSelectedClientId}
            />
          )}

          {activeView === 'equipment' && (
            <EquipmentView
              key={`android_eq_${dataVersion}`}
              onStartNewTest={(eqId) => handleStartTest(eqId)}
              onOpenTestLaudo={(t) => setActiveLaudoTest(t)}
              initialSelectedEquipment={equipmentViewSelectedEq}
            />
          )}

          {activeView === 'service_orders' && (
            <ServiceOrdersView
              key={`android_so_${dataVersion}`}
              onStartTestForOS={(osId, eqId) => handleStartTest(eqId, osId)}
              onOpenReportForOS={handleOpenReportEmission}
            />
          )}

          {activeView === 'clients' && <ClientsView key={`android_clients_${dataVersion}`} />}

          {activeView === 'instruments' && <LabInstrumentsView key={`android_inst_${dataVersion}`} />}

          {activeView === 'norms' && <NormsView key={`android_norms_${dataVersion}`} />}

          {activeView === 'sync' && (
            <SyncManagerView
              key={`android_sync_${dataVersion}`}
              isOnline={isOnline}
              onToggleOnline={() => setIsOnline(!isOnline)}
              onManualSync={handleTriggerSync}
              isSyncing={isSyncing}
            />
          )}

          {activeView === 'audit' && <AuditLogsView key={`android_audit_${dataVersion}`} />}

          {activeView === 'backup' && <BackupSettingsView key={`android_backup_${dataVersion}`} />}
          </ViewErrorBoundary>
        </AndroidAppShell>

        {/* MODAL: QR Code Live Scanner & Lookup */}
        <QRCodeScannerModal
          isOpen={isQRScannerOpen}
          onClose={() => setIsQRScannerOpen(false)}
          onSelectEquipment={(eq) => {
            setEquipmentViewSelectedEq(eq);
            setActiveView('equipment');
          }}
          onSelectValidationCode={(code) => {
            setValidationCodeForPortal(code);
            setActiveView('validar');
          }}
        />

        {/* MODAL: Laudo Técnico PDF Viewer */}
        <LaudoViewModal
          test={activeLaudoTest}
          isOpen={!!activeLaudoTest}
          onClose={() => setActiveLaudoTest(null)}
          onEditTest={handleEditTest}
        />

        {/* MODAL: Certificado de Conformidade PDF Viewer */}
        <CertificadoViewModal
          test={activeCertificadoTest}
          isOpen={!!activeCertificadoTest}
          onClose={() => setActiveCertificadoTest(null)}
          onEditTest={handleEditTest}
        />

        {/* MODAL: Guia de Instalação Android PWA / APK */}
        <AndroidInstallModal
          isOpen={isInstallModalOpen}
          onClose={() => setIsInstallModalOpen(false)}
          onLaunchAndroidMode={() => setIsFieldMode(true)}
        />

        {/* MODAL: Gerenciador de Arquivos e Laudos Salvos no Dispositivo */}
        <LocalDeviceFilesManagerModal
          isOpen={isDeviceFilesModalOpen}
          onClose={() => setIsDeviceFilesModalOpen(false)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col antialiased text-slate-800 relative">
      {/* Floating Sync Notification Toast */}
      {syncToast && (
        <div className="fixed top-4 right-4 z-50 max-w-md animate-bounce-short shadow-2xl rounded-2xl overflow-hidden border">
          <div className={`p-4 flex items-start gap-3 ${
            syncToast.type === 'success' 
              ? 'bg-emerald-900 border-emerald-500 text-white' 
              : syncToast.type === 'error'
              ? 'bg-red-900 border-red-500 text-white'
              : 'bg-slate-900 border-slate-700 text-white'
          }`}>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-bold ${
              syncToast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-orange-500 text-white'
            }`}>
              ✓
            </div>
            <div className="flex-1 text-xs">
              <p className="font-bold text-sm">
                {syncToast.type === 'success' ? 'Sincronização com a Nuvem' : 'Aviso de Armazenamento'}
              </p>
              <p className="text-slate-200 mt-0.5 leading-relaxed">{syncToast.message}</p>
            </div>
            <button 
              onClick={() => setSyncToast(null)}
              className="text-slate-400 hover:text-white text-xs font-bold px-1"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Top Main Navigation Bar */}
      <Navbar
        currentUser={currentUser}
        onUserChange={setCurrentUser}
        isOnline={isOnline}
        onToggleOnline={() => setIsOnline(!isOnline)}
        onOpenQRScanner={() => setIsQRScannerOpen(true)}
        onOpenMobileCamera={() => setIsGlobalMobileCamOpen(true)}
        isFieldMode={isFieldMode}
        onToggleFieldMode={() => setIsFieldMode(!isFieldMode)}
        onOpenInstallModal={() => setIsInstallModalOpen(true)}
        pendingSyncCount={pendingSyncCount}
        onTriggerSync={handleTriggerSync}
        isSyncing={isSyncing}
        onNavigate={setActiveView}
        activeView={activeView}
        onLogout={handleLogout}
      />

      {/* Main Container Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sidebar */}
        <Sidebar
          activeView={activeView}
          onNavigate={setActiveView}
          userRole={currentUser.role}
          pendingSyncCount={pendingSyncCount}
          onToggleFieldMode={() => setIsFieldMode(!isFieldMode)}
          onOpenInstallModal={() => setIsInstallModalOpen(true)}
        />

        {/* Dynamic Content Canvas */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <ViewErrorBoundary resetKey={activeView} onGoHome={() => setActiveView('dashboard')}>
          {activeView === 'dashboard' && (
            <DashboardView
              key={`desk_dash_${dataVersion}`}
              onNavigate={setActiveView}
              onOpenTestLaudo={(t) => setActiveLaudoTest(t)}
              onOpenTestCertificado={(t) => setActiveCertificadoTest(t)}
              onEditTest={handleEditTest}
              onSelectEquipment={(eq) => {
                setEquipmentViewSelectedEq(eq);
                setActiveView('equipment');
              }}
              onStartNewTestWithEquipment={(eqId) => handleStartTest(eqId)}
            />
          )}

          {activeView === 'wizard' && (
            <TestWizardView
              key={`desk_wiz_${editingTest?.id || wizardPreSelectedEqId || 'new'}_${wizardPreSelectedOSId || 'none'}`}
              currentUser={currentUser}
              onFinishTest={handleTestFinished}
              editingTest={editingTest}
              onCancelEdit={() => {
                setEditingTest(null);
                setActiveView('tests');
              }}
              preSelectedEquipmentId={wizardPreSelectedEqId}
              preSelectedOSId={wizardPreSelectedOSId}
            />
          )}

          {activeView === 'tests' && (
            <TestsListView
              key={`desk_tests_${dataVersion}`}
              onOpenLaudo={(t) => setActiveLaudoTest(t)}
              onOpenCertificado={(t) => setActiveCertificadoTest(t)}
              onStartNewTest={() => handleStartTest()}
              onEditTest={handleEditTest}
              onValidateOnline={(code) => {
                setValidationCodeForPortal(code);
                setActiveView('validar');
              }}
              onOpenReportEmission={() => setActiveView('reports')}
            />
          )}

          {activeView === 'reports' && (
            <ReportEmissionView
              key={`desk_reports_${dataVersion}_${reportPreSelectedOSId || 'none'}`}
              currentUser={currentUser}
              onOpenTestLaudo={(t) => setActiveLaudoTest(t)}
              preSelectedOSId={reportPreSelectedOSId}
              preSelectedClientId={reportPreSelectedClientId}
            />
          )}

          {activeView === 'equipment' && (
            <EquipmentView
              key={`desk_eq_${dataVersion}`}
              onStartNewTest={(eqId) => handleStartTest(eqId)}
              onOpenTestLaudo={(t) => setActiveLaudoTest(t)}
              initialSelectedEquipment={equipmentViewSelectedEq}
            />
          )}

          {activeView === 'service_orders' && (
            <ServiceOrdersView
              key={`desk_so_${dataVersion}`}
              onStartTestForOS={(osId, eqId) => handleStartTest(eqId, osId)}
              onOpenReportForOS={handleOpenReportEmission}
            />
          )}

          {activeView === 'clients' && <ClientsView key={`desk_clients_${dataVersion}`} />}

          {activeView === 'instruments' && <LabInstrumentsView key={`desk_inst_${dataVersion}`} />}

          {activeView === 'norms' && <NormsView key={`desk_norms_${dataVersion}`} />}

          {activeView === 'sync' && (
            <SyncManagerView
              key={`desk_sync_${dataVersion}`}
              isOnline={isOnline}
              onToggleOnline={() => setIsOnline(!isOnline)}
              onManualSync={handleTriggerSync}
              isSyncing={isSyncing}
            />
          )}

          {activeView === 'audit' && <AuditLogsView key={`desk_audit_${dataVersion}`} />}

          {activeView === 'backup' && <BackupSettingsView key={`desk_backup_${dataVersion}`} />}
          </ViewErrorBoundary>
        </main>
      </div>

      {/* Mobile Android Bottom Nav (visible only on small screens) */}
      <MobileBottomNav
        activeView={activeView}
        onNavigate={setActiveView}
        onOpenQRScanner={() => setIsQRScannerOpen(true)}
        pendingSyncCount={pendingSyncCount}
      />

      {/* MODAL: QR Code Live Scanner & Lookup */}
      <QRCodeScannerModal
        isOpen={isQRScannerOpen}
        onClose={() => setIsQRScannerOpen(false)}
        onSelectEquipment={(eq) => {
          setEquipmentViewSelectedEq(eq);
          setActiveView('equipment');
        }}
        onSelectValidationCode={(code) => {
          setValidationCodeForPortal(code);
          setActiveView('validar');
        }}
      />

      {/* MODAL: Laudo Técnico PDF Viewer */}
      <LaudoViewModal
        test={activeLaudoTest}
        isOpen={!!activeLaudoTest}
        onClose={() => setActiveLaudoTest(null)}
      />

      {/* MODAL: Certificado de Conformidade PDF Viewer */}
      <CertificadoViewModal
        test={activeCertificadoTest}
        isOpen={!!activeCertificadoTest}
        onClose={() => setActiveCertificadoTest(null)}
      />

      {/* MODAL: Guia de Instalação Android PWA / APK */}
      <AndroidInstallModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
        onLaunchAndroidMode={() => setIsFieldMode(true)}
      />

      {/* MODAL: Global Mobile Camera Connection Bridge */}
      <MobileCameraBridgeModal
        isOpen={isGlobalMobileCamOpen}
        onClose={() => setIsGlobalMobileCamOpen(false)}
        userName={currentUser.name}
        onScanReceived={(code) => {
          setIsGlobalMobileCamOpen(false);
          const allEq = DielectricStorageService.getEquipment();
          const match = allEq.find(e => e.serialNumber.toLowerCase() === code.toLowerCase() || e.qrCode.toLowerCase() === code.toLowerCase() || e.tag?.toLowerCase() === code.toLowerCase() || e.assetNumber?.toLowerCase() === code.toLowerCase());
          if (match) {
            setEquipmentViewSelectedEq(match);
            setActiveView('equipment');
          } else {
            setValidationCodeForPortal(code);
            setActiveView('validar');
          }
        }}
      />

      {/* MODAL: Gerenciador de Arquivos e Laudos Salvos no Dispositivo */}
      <LocalDeviceFilesManagerModal
        isOpen={isDeviceFilesModalOpen}
        onClose={() => setIsDeviceFilesModalOpen(false)}
      />
    </div>
  );
}
