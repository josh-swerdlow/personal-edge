// User-friendly error modal for sync and network errors with retry option

import { useState } from 'react';
import { FaExclamationTriangle, FaRedo, FaTimes } from 'react-icons/fa';

interface SyncErrorModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onRetry?: () => Promise<void>;
  onClose: () => void;
  isRetrying?: boolean;
}

export default function SyncErrorModal({
  isOpen,
  title,
  message,
  onRetry,
  onClose,
  isRetrying = false,
}: SyncErrorModalProps) {
  const [isRetryInProgress, setIsRetryInProgress] = useState(false);

  if (!isOpen) return null;

  const handleRetry = async () => {
    if (!onRetry || isRetryInProgress) return;

    setIsRetryInProgress(true);
    try {
      await onRetry();
      onClose();
    } catch (error) {
      // Error will be handled by the caller
    } finally {
      setIsRetryInProgress(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="liquid-glass liquid-glass--card max-w-md w-full">
        <div className="liquid-glass__content p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <FaExclamationTriangle className="text-yellow-400 text-2xl flex-shrink-0" />
              <h2 className="text-xl font-bold text-white">{title}</h2>
            </div>
            <button
              onClick={onClose}
              className="text-white/70 hover:text-white transition-colors"
              aria-label="Close"
            >
              <FaTimes size={20} />
            </button>
          </div>

          <p className="text-white mb-6">{message}</p>

          <div className="flex gap-3 justify-end">
            {onRetry && (
              <button
                onClick={handleRetry}
                disabled={isRetryInProgress || isRetrying}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <FaRedo className={isRetryInProgress || isRetrying ? 'animate-spin' : ''} />
                {isRetryInProgress || isRetrying ? 'Retrying...' : 'Retry'}
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors"
            >
              {onRetry ? 'Close' : 'OK'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

