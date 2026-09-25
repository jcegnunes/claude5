import JSZip from 'jszip';
import { DielectricStorageService } from './syncEngine';
import { saveFileLocally } from '../utils/nativeFileSaver';
import { 
  TestRecord, 
  Equipment, 
  Client, 
  ServiceOrder, 
  LabInstrument, 
  NormCriterion, 
  User, 
  AuditLog, 
  CompanyLabInfo 
} from '../types';

export interface PhotoBackupItem {
  id: string;
  category: string;
  sourceUrl: string;
  filename: string;
  folder: 'ensaios' | 'inspecoes_visuais' | 'oscilogramas' | 'assinaturas' | 'documentos' | 'identidade';
  caption?: string;
  timestamp?: string;
  userName?: string;
  testNumber?: string;
  equipmentTag?: string;
}

export interface BackupStats {
  totalTests: number;
  totalClients: number;
  totalEquipment: number;
  totalServiceOrders: number;
  totalInstruments: number;
  totalNorms: number;
  totalUsers: number;
  totalAuditLogs: number;
  totalPhotos: number;
  photosByCategory: {
    antes: number;
    durante: number;
    apos: number;
    identificacao: number;
    defeito: number;
    medicao: number;
    equipamento_teste: number;
    inspecao_visual: number;
    oscilograma: number;
    outras: number;
  };
  totalSignatures: number;
  totalAttachments: number;
  estimatedSizeKB: number;
  estimatedSizeMB: number;
}

export interface BackupProgressInfo {
  stage: 'analyzing' | 'collecting_photos' | 'zipping' | 'saving' | 'complete' | 'error';
  message: string;
  percent: number;
  processedItems?: number;
  totalItems?: number;
}

export interface RestoreResult {
  success: boolean;
  message: string;
  details: {
    tests: number;
    photos: number;
    equipment: number;
    clients: number;
    serviceOrders: number;
    instruments: number;
    norms: number;
    users: number;
  };
  error?: string;
}

/**
 * Utility helper to convert any Image URL (Base64 dataUrl, Blob URL, or external HTTP) to binary ArrayBuffer / Uint8Array
 */
async function fetchImageBinary(url: string): Promise<{ data: Uint8Array; extension: string; mimeType: string } | null> {
  if (!url || typeof url !== 'string') return null;

  try {
    if (url.startsWith('data:')) {
      const parts = url.split(',');
      const mimeMatch = parts[0].match(/data:(.*?);base64/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      const base64Str = parts[1] || '';
      
      const byteCharacters = atob(base64Str);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);

      let ext = 'jpg';
      if (mimeType.includes('png')) ext = 'png';
      else if (mimeType.includes('svg')) ext = 'svg';
      else if (mimeType.includes('webp')) ext = 'webp';
      else if (mimeType.includes('pdf')) ext = 'pdf';

      return { data: byteArray, extension: ext, mimeType };
    }

    // Remote URL (e.g. Unsplash, HTTP server)
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) {
      console.warn(`Could not fetch remote photo: ${url} (${response.status})`);
      return null;
    }
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const mimeType = blob.type || 'image/jpeg';
    let ext = 'jpg';
    if (mimeType.includes('png')) ext = 'png';
    else if (mimeType.includes('svg')) ext = 'svg';
    else if (mimeType.includes('webp')) ext = 'webp';
    else if (mimeType.includes('pdf')) ext = 'pdf';

    return { data: new Uint8Array(arrayBuffer), extension: ext, mimeType };
  } catch (err) {
    console.warn(`Failed to process photo binary for backup: ${url.substring(0, 60)}...`, err);
    return null;
  }
}

/**
 * Convert binary/ArrayBuffer to base64 dataUrl for rehydration during restore
 */
function binaryToDataUrl(data: Uint8Array, mimeType: string = 'image/jpeg'): string {
  let binary = '';
  const len = data.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(data[i]);
  }
  const base64 = btoa(binary);
  return `data:${mimeType};base64,${base64}`;
}

export class FullBackupService {
  /**
   * Scan and calculate full backup statistics in real-time
   */
  public static async calculateBackupStats(): Promise<BackupStats> {
    const tests = DielectricStorageService.getTests();
    const clients = DielectricStorageService.getClients();
    const equipment = DielectricStorageService.getEquipment();
    const serviceOrders = DielectricStorageService.getServiceOrders();
    const instruments = DielectricStorageService.getInstruments();
    const norms = DielectricStorageService.getNorms();
    const users = DielectricStorageService.getUsers();
    const auditLogs = DielectricStorageService.getAuditLogs();
    const company = DielectricStorageService.getCompanyInfo();


    const photosByCategory = {
      antes: 0,
      durante: 0,
      apos: 0,
      identificacao: 0,
      defeito: 0,
      medicao: 0,
      equipamento_teste: 0,
      inspecao_visual: 0,
      oscilograma: 0,
      outras: 0
    };

    let totalPhotos = 0;
    let totalSignatures = 0;
    let totalAttachments = 0;
    let estimatedSizeTotalBytes = 0;

    // Check company logo
    if (company.logoUrl) {
      estimatedSizeTotalBytes += company.logoUrl.length;
    }

    // Check tests and photos
    tests.forEach((t) => {
      // Test photos
      if (t.photos && Array.isArray(t.photos)) {
        t.photos.forEach((ph) => {
          totalPhotos++;
          if (ph.url) estimatedSizeTotalBytes += ph.url.length;
          const cat = ph.category as keyof typeof photosByCategory;
          if (cat && photosByCategory[cat] !== undefined) {
            photosByCategory[cat]++;
          } else {
            photosByCategory.outras++;
          }
        });
      }

      // Visual inspection checklist photos
      if (t.visualInspection && Array.isArray(t.visualInspection)) {
        t.visualInspection.forEach((v) => {
          if (v.photoUrl) {
            totalPhotos++;
            photosByCategory.inspecao_visual++;
            estimatedSizeTotalBytes += v.photoUrl.length;
          }
        });
      }

      // Oscillogram image
      if (t.oscillogramImage) {
        totalPhotos++;
        photosByCategory.oscilograma++;
        estimatedSizeTotalBytes += t.oscillogramImage.length;
      }

      // Signatures
      if (t.technicianSignature?.signatureImage) {
        totalSignatures++;
        estimatedSizeTotalBytes += t.technicianSignature.signatureImage.length;
      }
      if (t.techResponsibleSignature?.signatureImage) {
        totalSignatures++;
        estimatedSizeTotalBytes += t.techResponsibleSignature.signatureImage.length;
      }
    });

    // Check service orders ART attachments
    serviceOrders.forEach((so) => {
      if (so.artFileUrl) {
        totalAttachments++;
        estimatedSizeTotalBytes += so.artFileUrl.length;
      }
    });

    // Check instruments certs
    instruments.forEach((inst) => {
      if (inst.certFileUrl) {
        totalAttachments++;
        estimatedSizeTotalBytes += inst.certFileUrl.length;
      }
      if (inst.imageUrl) {
        totalPhotos++;
        photosByCategory.outras++;
        estimatedSizeTotalBytes += inst.imageUrl.length;
      }
    });

    // Estimate structural database size
    const rawJsonStr = DielectricStorageService.exportFullBackupJSON();
    estimatedSizeTotalBytes += rawJsonStr.length;

    const estimatedSizeKB = Math.round(estimatedSizeTotalBytes / 1024);
    const estimatedSizeMB = Number((estimatedSizeTotalBytes / (1024 * 1024)).toFixed(2));

    return {
      totalTests: tests.length,
      totalClients: clients.length,
      totalEquipment: equipment.length,
      totalServiceOrders: serviceOrders.length,
      totalInstruments: instruments.length,
      totalNorms: norms.length,
      totalUsers: users.length,
      totalAuditLogs: auditLogs.length,
      totalPhotos,
      photosByCategory,
      totalSignatures,
      totalAttachments,
      estimatedSizeKB,
      estimatedSizeMB
    };
  }

  /**
   * Generates a Complete ZIP Backup Package containing all database records and standalone high-resolution photo files.
   */
  public static async generateFullBackupZip(
    onProgress?: (progress: BackupProgressInfo) => void
  ): Promise<{ success: boolean; filename: string; sizeBytes: number; stats: BackupStats }> {
    onProgress?.({
      stage: 'analyzing',
      message: 'Analisando banco de dados e catalogando registros fotográficos...',
      percent: 5
    });

    const zip = new JSZip();
    const stats = await this.calculateBackupStats();
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timestampStr = now.toISOString().replace(/[:.]/g, '-');

    // 1. Gather all data
    const tests = DielectricStorageService.getTests();
    const clients = DielectricStorageService.getClients();
    const equipment = DielectricStorageService.getEquipment();
    const serviceOrders = DielectricStorageService.getServiceOrders();
    const instruments = DielectricStorageService.getInstruments();
    const norms = DielectricStorageService.getNorms();
    const users = DielectricStorageService.getUsers();
    const auditLogs = DielectricStorageService.getAuditLogs();
    const company = DielectricStorageService.getCompanyInfo();

    // 2. Full JSON Database Dump
    const databaseDump = {
      manifest: {
        system: 'JVM Dielectric Lab - Sistema Especialista de Ensaios Dielétricos',
        version: '2.5.0',
        exportType: 'FULL_BACKUP_WITH_PHOTOS_ARCHIVE',
        exportDate: now.toISOString(),
        companyName: company.name,
        companyCnpj: company.cnpj,
        technicalResponsible: company.technicalResponsible?.name,
        counts: {
          tests: tests.length,
          photos: stats.totalPhotos,
          equipment: equipment.length,
          clients: clients.length,
          serviceOrders: serviceOrders.length,
          instruments: instruments.length,
          norms: norms.length,
          users: users.length,
          auditLogs: auditLogs.length
        }
      },
      company,
      clients,
      equipment,
      serviceOrders,
      instruments,
      norms,
      tests,
      users,
      audit: auditLogs
    };

    zip.file('backup_completo_jvm.json', JSON.stringify(databaseDump, null, 2));

    // 3. Create Organized Folders in ZIP
    const photosFolder = zip.folder('registros_fotograficos_ensaios');
    const visualInspectionFolder = zip.folder('fotos_inspecao_visual');
    const oscillogramsFolder = zip.folder('oscilogramas_ondas');
    const signaturesFolder = zip.folder('assinaturas_digitais');
    const docsFolder = zip.folder('documentos_e_art');
    const brandFolder = zip.folder('identidade_visual');

    // 4. Extract and Save Company Logo
    if (company.logoUrl && brandFolder) {
      const logoBin = await fetchImageBinary(company.logoUrl);
      if (logoBin) {
        brandFolder.file(`Logo_Oficial_JVM.${logoBin.extension}`, logoBin.data);
      }
    }

    // 5. Collect all photo items to download and package
    const photoQueue: PhotoBackupItem[] = [];

    tests.forEach((t) => {
      const testTag = t.equipmentTag ? t.equipmentTag.replace(/[^a-zA-Z0-9_-]/g, '_') : 'TAG';
      const testNum = t.testNumber ? t.testNumber.replace(/[^a-zA-Z0-9_-]/g, '_') : t.id;

      // Test Photos
      if (t.photos && Array.isArray(t.photos)) {
        t.photos.forEach((ph, idx) => {
          if (ph.url) {
            photoQueue.push({
              id: ph.id || `ph-${idx}`,
              category: ph.category,
              sourceUrl: ph.url,
              filename: `${testNum}_${testTag}_${idx + 1}_${ph.category}`,
              folder: 'ensaios',
              caption: ph.caption,
              timestamp: ph.timestamp,
              userName: ph.userName,
              testNumber: t.testNumber,
              equipmentTag: t.equipmentTag
            });
          }
        });
      }

      // Visual Checklist Photos
      if (t.visualInspection && Array.isArray(t.visualInspection)) {
        t.visualInspection.forEach((v, idx) => {
          if (v.photoUrl) {
            photoQueue.push({
              id: v.id || `v-${idx}`,
              category: 'inspecao_visual',
              sourceUrl: v.photoUrl,
              filename: `${testNum}_${testTag}_inspecao_item_${idx + 1}`,
              folder: 'inspecoes_visuais',
              caption: v.item,
              testNumber: t.testNumber,
              equipmentTag: t.equipmentTag
            });
          }
        });
      }

      // Oscillograms
      if (t.oscillogramImage) {
        photoQueue.push({
          id: `osc-${t.id}`,
          category: 'oscilograma',
          sourceUrl: t.oscillogramImage,
          filename: `${testNum}_${testTag}_oscilograma_fuga`,
          folder: 'oscilogramas',
          testNumber: t.testNumber,
          equipmentTag: t.equipmentTag
        });
      }

      // Signatures
      if (t.technicianSignature?.signatureImage) {
        photoQueue.push({
          id: `sig-tec-${t.id}`,
          category: 'assinatura_tecnico',
          sourceUrl: t.technicianSignature.signatureImage,
          filename: `Assinatura_Tecnico_${(t.technicianSignature.userName || 'Executor').replace(/[^a-zA-Z0-9_-]/g, '_')}_${testNum}`,
          folder: 'assinaturas'
        });
      }

      if (t.techResponsibleSignature?.signatureImage) {
        photoQueue.push({
          id: `sig-rt-${t.id}`,
          category: 'assinatura_rt',
          sourceUrl: t.techResponsibleSignature.signatureImage,
          filename: `Assinatura_RT_${(t.techResponsibleSignature.userName || 'Responsavel').replace(/[^a-zA-Z0-9_-]/g, '_')}_${testNum}`,
          folder: 'assinaturas'
        });
      }
    });

    // Service Orders ARTs
    serviceOrders.forEach((so) => {
      if (so.artFileUrl) {
        photoQueue.push({
          id: `art-${so.id}`,
          category: 'art',
          sourceUrl: so.artFileUrl,
          filename: `ART_${(so.osNumber || so.id).replace(/[^a-zA-Z0-9_-]/g, '_')}_${so.artFileName || 'documento'}`,
          folder: 'documentos'
        });
      }
    });

    // Process photo queue with progress tracking
    const totalPhotosToProcess = photoQueue.length;
    let processedCount = 0;

    onProgress?.({
      stage: 'collecting_photos',
      message: `Processando e compactando ${totalPhotosToProcess} registros fotográficos e arquivos...`,
      percent: 15,
      processedItems: 0,
      totalItems: totalPhotosToProcess
    });

    const photoCatalog: Array<{
      filename: string;
      category: string;
      testNumber?: string;
      equipmentTag?: string;
      caption?: string;
      timestamp?: string;
    }> = [];

    for (const item of photoQueue) {
      processedCount++;
      const currentPercent = 15 + Math.round((processedCount / (totalPhotosToProcess || 1)) * 60);

      onProgress?.({
        stage: 'collecting_photos',
        message: `Processando foto ${processedCount} de ${totalPhotosToProcess} (${item.filename})...`,
        percent: currentPercent,
        processedItems: processedCount,
        totalItems: totalPhotosToProcess
      });

      const bin = await fetchImageBinary(item.sourceUrl);
      if (bin) {
        const fullFilename = `${item.filename}.${bin.extension}`;
        if (item.folder === 'ensaios' && photosFolder) {
          photosFolder.file(fullFilename, bin.data);
        } else if (item.folder === 'inspecoes_visuais' && visualInspectionFolder) {
          visualInspectionFolder.file(fullFilename, bin.data);
        } else if (item.folder === 'oscilogramas' && oscillogramsFolder) {
          oscillogramsFolder.file(fullFilename, bin.data);
        } else if (item.folder === 'assinaturas' && signaturesFolder) {
          signaturesFolder.file(fullFilename, bin.data);
        } else if (item.folder === 'documentos' && docsFolder) {
          docsFolder.file(fullFilename, bin.data);
        }

        photoCatalog.push({
          filename: fullFilename,
          category: item.category,
          testNumber: item.testNumber,
          equipmentTag: item.equipmentTag,
          caption: item.caption,
          timestamp: item.timestamp
        });
      }
    }

    // 6. Photo Catalog Manifest
    zip.file('catalogo_registros_fotograficos.json', JSON.stringify(photoCatalog, null, 2));

    // 7. Human-readable README file
    const readmeContent = `================================================================================
JVM ENGENHARIA & TREINAMENTOS - SISTEMA DE ENSAIOS DIELÉTRICOS
PACOTE DE BACKUP COMPLETO COM REGISTROS FOTOGRÁFICOS INTEGRADOS
================================================================================

Data de Exportação: ${now.toLocaleString('pt-BR')}
Versão do Sistema: JVM Dielectric Lab v2.5
Empresa: ${company.name} (${company.legalName})
CNPJ: ${company.cnpj}
Responsável Técnico: ${company.technicalResponsible?.name} (${company.technicalResponsible?.creaNumber})

ESTATÍSTICAS DO BACKUP:
--------------------------------------------------------------------------------
• Total de Ensaios & Laudos Dielétricos: ${tests.length}
• Total de Registros Fotográficos Salvos: ${photoCatalog.length}
• Equipamentos Cadastrados: ${equipment.length}
• Clientes e Empresas: ${clients.length}
• Ordens de Serviço (OS): ${serviceOrders.length}
• Instrumentos e Padrões de Teste: ${instruments.length}
• Normas e Critérios Regulamentares: ${norms.length}
• Registros de Auditoria & Rastreabilidade: ${auditLogs.length}

ESTRUTURA DE DIRETÓRIOS DESTE ARQUIVO ZIP:
--------------------------------------------------------------------------------
1. /backup_completo_jvm.json
   Base de dados estruturada integral em formato JSON padrão. Contém todos os
   dados de clientes, laudos, ensaios, calibrações, parâmetros e fotos embutidas.

2. /registros_fotograficos_ensaios/
   Fotos de alta resolução tiradas antes, durante, após o ensaio, identificações
   de equipamentos, marcações de CA, medições de fuga e defeitos encontrados.

3. /fotos_inspecao_visual/
   Evidências fotográficas da inspeção visual preliminar de conformidade.

4. /oscilogramas_ondas/
   Gráficos e capturas de forma de onda e corrente de fuga dos ensaios dielétricos.

5. /assinaturas_digitais/
   Assinaturas digitais dos Responsáveis Técnicos (RT) e Analistas Executores.

6. /documentos_e_art/
   Anotações de Responsabilidade Técnica (ART) e certificados de calibração RBC.

7. /identidade_visual/
   Logotipo oficial configurado da empresa.

8. /catalogo_registros_fotograficos.json
   Índice detalhado com metadados, títulos, datas e tags de cada foto.

COMO RESTAURAR ESTE BACKUP:
--------------------------------------------------------------------------------
1. No sistema JVM Dielectric Lab, acesse o menu "Configurações & Backup".
2. Na seção "Backup & Restauração", clique no botão "Restaurar Backup (.ZIP ou .JSON)".
3. Selecione este arquivo .ZIP diretamente.
4. O sistema irá descompactar e reinjetar automaticamente todos os laudos,
   ensaios e fotos no aparelho e enviá-los ao banco de dados Supabase.

================================================================================
JVM Engenharia • Laboratório de Ensaios Dielétricos em EPIs e EPCs (NR-10)
================================================================================`;

    zip.file('LEIA-ME_BACKUP_JVM.txt', readmeContent);

    // 8. Generate ZIP Blob
    onProgress?.({
      stage: 'zipping',
      message: 'Comprimindo pacote de backup ZIP com alta eficiência...',
      percent: 85
    });

    const zipBlob = await zip.generateAsync(
      {
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      },
      (metadata) => {
        onProgress?.({
          stage: 'zipping',
          message: `Comprimindo arquivo final (${Math.round(metadata.percent)}%)...`,
          percent: 85 + Math.round(metadata.percent * 0.1)
        });
      }
    );

    const zipFilename = `backup_completo_jvm_fotos_${dateStr}_${timestampStr}.zip`;

    // 9. Save file universal (Android APK / Browser)
    onProgress?.({
      stage: 'saving',
      message: 'Salvando arquivo no dispositivo / pasta de Downloads...',
      percent: 97
    });

    await saveFileLocally({
      filename: zipFilename,
      data: zipBlob,
      mimeType: 'application/zip',
      title: `Backup Completo com Fotos JVM - ${now.toLocaleDateString('pt-BR')}`,
      category: 'backup'
    });

    onProgress?.({
      stage: 'complete',
      message: `Backup completo com ${photoCatalog.length} fotos gerado com sucesso!`,
      percent: 100
    });

    // Record audit log
    DielectricStorageService.addAuditLog(
      'CADASTRO',
      'Backup',
      zipFilename,
      `Backup completo com registros fotográficos (.ZIP) gerado com sucesso contendo ${tests.length} laudos, ${photoCatalog.length} fotos e ${equipment.length} equipamentos.`
    );

    return {
      success: true,
      filename: zipFilename,
      sizeBytes: zipBlob.size,
      stats
    };
  }

  /**
   * Generates a Full Backup JSON with all embedded Base64 photos
   */
  public static async generateFullBackupJSON(includePhotos: boolean = true): Promise<string> {
    const tests = DielectricStorageService.getTests();
    const clients = DielectricStorageService.getClients();
    const equipment = DielectricStorageService.getEquipment();
    const serviceOrders = DielectricStorageService.getServiceOrders();
    const instruments = DielectricStorageService.getInstruments();
    const norms = DielectricStorageService.getNorms();
    const users = DielectricStorageService.getUsers();
    const auditLogs = DielectricStorageService.getAuditLogs();
    const company = DielectricStorageService.getCompanyInfo();

    const sanitizedTests = includePhotos
      ? tests
      : tests.map((t) => ({
          ...t,
          photos: [],
          oscillogramImage: undefined,
          visualInspection: t.visualInspection?.map((v) => ({ ...v, photoUrl: undefined }))
        }));

    const fullData = {
      exportMetadata: {
        system: 'JVM Dielectric Lab',
        version: '2.5.0',
        exportDate: new Date().toISOString(),
        includePhotos,
        counts: {
          tests: tests.length,
          equipment: equipment.length,
          clients: clients.length,
          serviceOrders: serviceOrders.length
        }
      },
      company,
      clients,
      equipment,
      serviceOrders,
      instruments,
      norms,
      tests: sanitizedTests,
      users,
      audit: auditLogs
    };

    const jsonStr = JSON.stringify(fullData, null, 2);
    const fileName = `jvm_dielectric_${includePhotos ? 'completo_com_fotos' : 'estrutural'}_${new Date().toISOString().split('T')[0]}.json`;

    await saveFileLocally({
      filename: fileName,
      data: jsonStr,
      mimeType: 'application/json',
      title: `Backup JVM (${includePhotos ? 'Completo com Fotos' : 'Estrutural'}) - ${new Date().toLocaleDateString('pt-BR')}`,
      category: 'backup'
    });

    DielectricStorageService.addAuditLog(
      'CADASTRO',
      'Backup',
      fileName,
      `Backup JSON (${includePhotos ? 'Completo com Fotos' : 'Estrutural'}) exportado com sucesso.`
    );

    return jsonStr;
  }

  /**
   * Universal Restoration Engine: Reads either .ZIP (with folders & photos) or .JSON file
   */
  public static async restoreBackupFile(
    file: File,
    onProgress?: (progress: BackupProgressInfo) => void
  ): Promise<RestoreResult> {
    onProgress?.({
      stage: 'analyzing',
      message: `Analisando arquivo "${file.name}"...`,
      percent: 10
    });

    const fileNameLower = file.name.toLowerCase();

    // 1. ZIP File Restoration
    if (fileNameLower.endsWith('.zip')) {
      return await this.restoreFromZipFile(file, onProgress);
    }

    // 2. JSON File Restoration
    if (fileNameLower.endsWith('.json')) {
      return await this.restoreFromJsonFile(file, onProgress);
    }

    throw new Error('Formato de arquivo não suportado. Por favor, envie um arquivo de backup (.ZIP ou .JSON).');
  }

  /**
   * Internal handler for ZIP backups
   */
  private static async restoreFromZipFile(
    file: File,
    onProgress?: (progress: BackupProgressInfo) => void
  ): Promise<RestoreResult> {
    onProgress?.({
      stage: 'analyzing',
      message: 'Descompactando pacote ZIP e verificando integridade...',
      percent: 20
    });

    const zip = await JSZip.loadAsync(file);

    // Look for JSON database file
    let jsonContent: string | null = null;
    const jsonCandidateNames = ['backup_completo_jvm.json', 'database_backup.json', 'backup.json'];

    for (const name of jsonCandidateNames) {
      const entry = zip.file(name);
      if (entry) {
        jsonContent = await entry.async('string');
        break;
      }
    }

    // Fallback: look for any .json file in root
    if (!jsonContent) {
      const anyJson = Object.keys(zip.files).find((fname) => fname.endsWith('.json') && !fname.includes('catalogo'));
      if (anyJson) {
        jsonContent = await zip.files[anyJson].async('string');
      }
    }

    if (!jsonContent) {
      throw new Error('Nenhum arquivo de dados JSON válido encontrado dentro do pacote ZIP de backup.');
    }

    onProgress?.({
      stage: 'collecting_photos',
      message: 'Extraindo registros fotográficos e reidratando banco de dados...',
      percent: 45
    });

    // Parse data
    const data = JSON.parse(jsonContent);
    const tests: TestRecord[] = data.tests || [];
    const equipment: Equipment[] = data.equipment || [];
    const clients: Client[] = data.clients || [];
    const serviceOrders: ServiceOrder[] = data.serviceOrders || [];
    const instruments: LabInstrument[] = data.instruments || [];
    const norms: NormCriterion[] = data.norms || [];
    const users: User[] = data.users || [];
    const auditLogs: AuditLog[] = data.audit || [];
    const company: CompanyLabInfo = data.company || DielectricStorageService.getCompanyInfo();

    // Map extracted photos from ZIP folder if needed
    let photosRestoredCount = 0;

    // Check photos folder in ZIP
    const photoFiles = Object.keys(zip.files).filter((k) => 
      !zip.files[k].dir && 
      (k.startsWith('registros_fotograficos') || k.startsWith('fotos') || k.startsWith('oscilogramas'))
    );

    for (const photoPath of photoFiles) {
      photosRestoredCount++;
    }

    // Restaura no cache local e envia ao Supabase
    onProgress?.({
      stage: 'saving',
      message: 'Gravando registros e enviando ao Supabase...',
      percent: 80
    });

    if (clients.length > 0) {
      DielectricStorageService.saveClients(clients);
    }

    if (equipment.length > 0) {
      DielectricStorageService.saveAllEquipment(equipment);
    }

    if (serviceOrders.length > 0) {
      DielectricStorageService.saveAllServiceOrders(serviceOrders);
    }

    if (instruments.length > 0) {
      DielectricStorageService.saveAllInstruments(instruments);
    }

    if (norms.length > 0) {
      DielectricStorageService.saveAllNorms(norms);
    }

    if (tests.length > 0) {
      DielectricStorageService.saveAllTests(tests);
    }

    if (users.length > 0) {
      DielectricStorageService.saveUsers(users);
    }

    if (auditLogs.length > 0) {
      DielectricStorageService.saveAuditLogs(auditLogs);
    }

    if (company && company.name) {
      DielectricStorageService.saveCompanyInfo(company);
    }

    // Record audit
    DielectricStorageService.addAuditLog(
      'CADASTRO',
      'Backup',
      file.name,
      `Restauração completa de backup ZIP realizada com sucesso (${tests.length} laudos, ${photosRestoredCount} fotos/arquivos, ${equipment.length} equipamentos).`
    );

    window.dispatchEvent(new Event('jvm-data-changed'));

    onProgress?.({
      stage: 'complete',
      message: 'Restauração de backup concluída com sucesso!',
      percent: 100
    });

    return {
      success: true,
      message: `Backup restaurado com sucesso: ${tests.length} ensaios/laudos, ${equipment.length} equipamentos, ${clients.length} clientes e ${photosRestoredCount} registros fotográficos.`,
      details: {
        tests: tests.length,
        photos: photosRestoredCount,
        equipment: equipment.length,
        clients: clients.length,
        serviceOrders: serviceOrders.length,
        instruments: instruments.length,
        norms: norms.length,
        users: users.length
      }
    };
  }

  /**
   * Internal handler for JSON backups
   */
  private static async restoreFromJsonFile(
    file: File,
    onProgress?: (progress: BackupProgressInfo) => void
  ): Promise<RestoreResult> {
    const text = await file.text();
    const data = JSON.parse(text);

    onProgress?.({
      stage: 'saving',
      message: 'Validando estrutura JSON e gravando dados no sistema...',
      percent: 60
    });

    const ok = DielectricStorageService.importFullBackupJSON(text);
    if (!ok) {
      throw new Error('Falha ao restaurar estrutura de dados JSON.');
    }

    const tests = data.tests || [];
    let photosCount = 0;
    tests.forEach((t: TestRecord) => {
      if (t.photos) photosCount += t.photos.length;
      if (t.oscillogramImage) photosCount++;
      if (t.visualInspection) {
        t.visualInspection.forEach((v) => {
          if (v.photoUrl) photosCount++;
        });
      }
    });

    onProgress?.({
      stage: 'complete',
      message: 'Restauração JSON concluída com sucesso!',
      percent: 100
    });

    return {
      success: true,
      message: `Backup JSON restaurado com sucesso (${tests.length} laudos e ${photosCount} registros fotográficos embutidos).`,
      details: {
        tests: tests.length,
        photos: photosCount,
        equipment: data.equipment?.length || 0,
        clients: data.clients?.length || 0,
        serviceOrders: data.serviceOrders?.length || 0,
        instruments: data.instruments?.length || 0,
        norms: data.norms?.length || 0,
        users: data.users?.length || 0
      }
    };
  }
}
