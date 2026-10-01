import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface Props {
  onClose: () => void;
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Proteção para janelas (laudo, certificado, leitor de QR...): se a janela
 * falhar ao desenhar, mostra o erro com "Fechar" em vez de deixar o app
 * inteiro em branco.
 */
export class ModalErrorBoundary extends React.Component<Props, State> {
  // O projeto não possui @types/react: os membros herdados são declarados aqui
  declare props: Props;
  declare setState: (state: Partial<State>) => void;
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[JVM] Erro ao abrir a janela:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const close = () => { this.setState({ error: null }); this.props.onClose(); };
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60" role="alertdialog" aria-modal="true" aria-label="Erro ao abrir a janela">
        <div className="bg-white border border-rose-200 rounded-2xl p-6 shadow-2xl max-w-md w-full space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-100 text-rose-600">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Não foi possível abrir esta janela</h3>
              <p className="text-xs text-slate-500">Seus dados estão preservados. Envie a mensagem abaixo ao suporte.</p>
            </div>
          </div>
          <pre className="text-[11px] bg-slate-50 border border-slate-200 rounded-xl p-3 text-rose-700 whitespace-pre-wrap break-all">
            {this.state.error.message || String(this.state.error)}
          </pre>
          <button
            type="button"
            onClick={close}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold cursor-pointer"
          >
            <X className="w-3.5 h-3.5" /> Fechar
          </button>
        </div>
      </div>
    );
  }
}
