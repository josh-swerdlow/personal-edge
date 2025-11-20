// Hook for handling write operation errors with user-friendly modals

import { useState, useCallback, ReactElement } from 'react';
import { getErrorMessage } from '../utils/errorHandler';
import SyncErrorModal from '../components/SyncErrorModal';

export function useWriteError() {
  const [error, setError] = useState<string | null>(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [retryFn, setRetryFn] = useState<(() => Promise<void>) | null>(null);

  const handleError = useCallback((error: any, retry?: () => Promise<void>) => {
    const errorMessage = getErrorMessage(error);
    setError(errorMessage);
    setRetryFn(retry ? async () => {
      try {
        await retry();
        setShowErrorModal(false);
        setError(null);
      } catch (err: any) {
        // Error will be shown in modal
        setError(getErrorMessage(err));
      }
    } : null);
    setShowErrorModal(true);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
    setShowErrorModal(false);
    setRetryFn(null);
  }, []);

  const ErrorModal = (): ReactElement => {
    return (
      <SyncErrorModal
        isOpen={showErrorModal}
        title="Operation Failed"
        message={error || 'An error occurred. Please try again.'}
        onRetry={retryFn || undefined}
        onClose={clearError}
      />
    );
  };

  return {
    handleError,
    clearError,
    ErrorModal,
    hasError: !!error,
  };
}
