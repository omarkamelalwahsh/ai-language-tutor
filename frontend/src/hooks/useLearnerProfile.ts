import { useState, useEffect } from 'react';
import { learnerService, IntelligenceProfile } from '../services/learnerService';

export function useLearnerProfile() {
  const [data, setData] = useState<IntelligenceProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchProfile() {
      try {
        setIsLoading(true);
        const profile = await learnerService.getProfile();
        setData(profile);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch profile'));
      } finally {
        setIsLoading(false);
      }
    }

    fetchProfile();
  }, []);

  return { data, isLoading, error };
}
