import { HomePage } from '@/pages/HomePage';

// `App` é mantido enxuto: agrega providers globais (futuros) e a árvore de páginas.
// Enquanto a POC tiver uma única tela, renderizamos diretamente a HomePage.
function App() {
  return <HomePage />;
}

export default App;
