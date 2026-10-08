// src/hooks/useHospitals.ts
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchHospitals,
  createHospital,
  updateHospital,
  deleteHospital,
  type HospitalInput,
} from '../services/hospitalsService';
import type { Hospital } from '../types/domain';

export function useHospitals() {
  const { user } = useAuth();
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchHospitals();
      setHospitals(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function add(input: HospitalInput) {
    if (!user) throw new Error('Usuário não autenticado.');
    const created = await createHospital(user.id, input);
    setHospitals((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
  }

  async function edit(id: string, input: HospitalInput) {
    const updated = await updateHospital(id, input);
    setHospitals((prev) => prev.map((h) => (h.id === id ? updated : h)));
  }

  async function remove(id: string) {
    await deleteHospital(id);
    setHospitals((prev) => prev.filter((h) => h.id !== id));
  }

  return { hospitals, isLoading, error, refetch: load, add, edit, remove };
}