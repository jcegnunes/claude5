import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  /** Muda a cada troca de tela: limpa o erro automaticamente. */
  resetKey: string;
  onGoHome?: () => void;
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Evita a "página em branco": se uma tela falhar ao desenhar (por exemplo,
 * por um registro incompleto vindo do banco), mostra o erro e permite
 * voltar, em vez de derrubar a aplicação inteira.
 */
export class ViewErrorBoundary extends React.Component<Props, State> {
  // O projeto não possui @types/react: os membros herdados são declarados aqui
  declare props: Props;
  declare setState: (state: Partial<State>) => void;
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[JVM] Erro ao exibir a tela:', error, info.componentStack);
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="max-w-xl mx-auto mt-10 bg-white border border-rose-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-rose-100 text-rose-600">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Esta tela encontrou um erro</h3>
            <p className="text-xs text-slate-500">Seus dados estão preservados. Envie a mensagem abaixo ao suporte.</p>
          </div>
        </div>
        <pre className="text-[11px] bg-slate-50 border border-slate-200 rounded-xl p-3 text-rose-700 whitespace-pre-wrap break-all">
          {this.state.error.message || String(this.state.error)}
        </pre>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Tentar novamente
          </button>
          {this.props.onGoHome && (
            <button
              type="button"
              onClick={() => { this.setState({ error: null }); this.props.onGoHome?.(); }}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold cursor-pointer"
            >
              <Home className="w-3.5 h-3.5" /> Voltar ao Painel
            </button>
          )}
        </div>
      </div>
    );
  }
}
