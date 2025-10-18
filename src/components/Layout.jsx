import Header from './Header';
import Sidebar from './Sidebar';

function Layout({ children }) {
  console.log('🏗️ Layout renderizando, children:', children);
  
  return (
    <div style={{ minHeight: '100vh', background: '#ecf0f1' }}>
      <Header />
      <div style={{ display: 'flex' }}>
        <Sidebar />
        <main style={{
          flex: 1,
          padding: '2rem',
          minHeight: 'calc(100vh - 82px)'
        }}>
          {children}
        </main>
      </div>
    </div>
  );
}

export default Layout;
