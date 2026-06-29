import styles from './page.module.css';
import SessionList from './components/SessionList';
import MemorySearch from './components/MemorySearch';

export default function Home() {
  return (
    <main className={styles.container}>
      <header className={`${styles.header} animate-fade-in`}>
        <h1 className={styles.title}>Dev Context Cognee</h1>
        <p className={styles.subtitle}>
          Your unified development memory. View ingested terminal logs and search across your knowledge graph.
        </p>
      </header>

      <div className={styles.grid}>
        <div style={{ animationDelay: '0.1s' }} className="animate-fade-in">
          <SessionList />
        </div>
        <div style={{ animationDelay: '0.2s' }} className="animate-fade-in">
          <MemorySearch />
        </div>
      </div>
    </main>
  );
}
