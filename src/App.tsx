import { DesignSystemTokensPage } from '@/pages/DesignSystemTokensPage';
import { HomePage } from '@/pages/HomePage';
import { useDesignSystemStore } from '@/stores/design-system-store';

// `App` mantém a navegação entre a seleção de design system e o workspace de tokens.
function App() {
  const activeId = useDesignSystemStore((s) => s.activeDesignSystemId);

  if (activeId) {
    return <DesignSystemTokensPage />;
  }

  return <HomePage />;
}

export default App;
