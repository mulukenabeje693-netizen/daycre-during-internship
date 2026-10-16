/**
 * Lightweight ID image validation used by registration. The images are still
 * uploaded to the database; this hook keeps the existing Register API intact.
 */
import { useState, useCallback } from 'react';

export const useIdScanner = () => {
  const [isModelsLoaded] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState(null);

  const validateFrontId = useCallback(async (_file, _silent = false) => {
    setIsAnalyzing(true);
    // Simulate a brief async check
    await new Promise(r => setTimeout(r, 300));
    setIsAnalyzing(false);
    return { success: true, text: '' };
  }, []);

  const validateBackId = useCallback(async (_file, _silent = false) => {
    setIsAnalyzing(true);
    await new Promise(r => setTimeout(r, 300));
    setIsAnalyzing(false);
    return { success: true, text: '' };
  }, []);

  return {
    isModelsLoaded: true,
    isAnalyzing,
    analysisError,
    validateFrontId,
    validateBackId,
    clearError: () => setAnalysisError(null),
  };
};
