import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Unhandled error in EvoluTigas:', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
          <div className="w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-semibold text-slate-800 mb-2">Algo deu errado nesta página</h2>
          <p className="text-sm text-slate-500 mb-6 max-w-md">
            Um erro inesperado interrompeu esta tela. Seus outros dados não foram afetados. Você pode tentar novamente
            ou voltar para o menu inicial.
          </p>
          {this.state.error && (
            <pre className="text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-md p-3 mb-6 max-w-md overflow-auto text-left">
              {this.state.error.message}
            </pre>
          )}
          <div className="flex gap-3">
            <Button variant="outline" onClick={this.handleReset}>
              <RotateCcw className="w-4 h-4 mr-2" /> Tentar novamente
            </Button>
            <Button onClick={() => (window.location.href = '/')}>Voltar ao início</Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
