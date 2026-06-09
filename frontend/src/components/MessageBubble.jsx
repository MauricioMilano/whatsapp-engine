import styles from './MessageBubble.module.css';

export default function MessageBubble({ message, onButtonClick }) {
  const { direction, content, intent, intentScore, createdAt } = message;
  const isIncoming = direction === 'incoming';

  function formatTime(isoString) {
    if (!isoString) return '';
    return new Date(isoString).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function renderContent() {
    if (!content) return null;

    switch (content.type) {
      case 'text':
        return <p className={styles.text}>{content.body}</p>;
      
      case 'button':
        return (
          <div className={styles.buttonContent}>
            <span className={styles.buttonLabel}>Button: {content.buttonId}</span>
          </div>
        );
      
      case 'image':
        return (
          <div className={styles.mediaContent}>
            <span>🖼️ {content.filename || 'Image'}</span>
            {content.caption && <span className={styles.caption}>{content.caption}</span>}
          </div>
        );
      
      case 'audio':
        return <span>🎵 {content.filename || 'Audio'}</span>;
      
      case 'document':
        return (
          <div className={styles.mediaContent}>
            <span>📄 {content.filename || 'Document'}</span>
            {content.caption && <span className={styles.caption}>{content.caption}</span>}
          </div>
        );
      
      default:
        return <span>{JSON.stringify(content)}</span>;
    }
  }

  return (
    <div className={`${styles.bubble} ${isIncoming ? styles.incoming : styles.outgoing}`}>
      <div className={styles.content}>
        {renderContent()}
        
        {isIncoming && intent && (
          <div className={styles.intent}>
            <span className={styles.intentLabel}>
              🎯 {intent}
            </span>
            {intentScore != null && (
              <span className={styles.score}>
                ({Math.round(intentScore * 100)}%)
              </span>
            )}
          </div>
        )}
      </div>
      
      <div className={styles.meta}>
        <span className={styles.time}>{formatTime(createdAt)}</span>
      </div>

      {/* Render buttons if present in context (from bot response) */}
      {message.buttons && message.buttons.length > 0 && (
        <div className={styles.buttons}>
          {message.buttons.map(btn => (
            <button
              key={btn.id}
              className={styles.button}
              onClick={() => onButtonClick(btn.id)}
            >
              {btn.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}