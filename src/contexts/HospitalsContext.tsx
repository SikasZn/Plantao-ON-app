// src/contexts/HospitalsContext.tsx
//
// Estado compartilhado dos hospitais entre todas as telas que precisam dele
// (Hospitais, Plantões, formulário de Plantão). Antes cada tela buscava por
// conta própria com useHospitals() — o problema: uma tela que já estava
// montada não sabia que um hospital novo tinha sido criado em outra aba, a
// menos que alguém lembrasse de forçar um refetch. Com contexto, todo mundo
// lê do mesmo estado, então uma criação em qualquer lugar já reflete em todos.
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import {
  fetchHospitals,
  createHospital,
  updateHospital,
  deleteHospital,
  type HospitalInput,
} from '../services/hospitalsService';
import type { Hospital } from '../types/domain';

interface HospitalsContextValue {
  hospitals: Hospital[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  add: (input: HospitalInput) => Promise<void>;
  edit: (id: string, input: HospitalInput) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

const HospitalsContext = createContext<HospitalsContextValue | undefined>(undefined);

export function HospitalsProvider({ children }: { children: React.ReactNode }) {
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

  return (
    <HospitalsContext.Provider value={{ hospitals, isLoading, error, refetch: load, add, edit, remove }}>
      {children}
    </HospitalsContext.Provider>
  );
}

export function useHospitals() {
  const context = useContext(HospitalsContext);
  if (!context) {
    throw new Error('useHospitals precisa ser usado dentro de um <HospitalsProvider>.');
  }
  return context;
}