import { createContext, useContext, useState, ReactNode } from 'react';
import { format } from 'date-fns';

interface SelectedDateContextType {
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  resetToToday: () => void;
}

const SelectedDateContext = createContext<SelectedDateContextType | null>(null);

export function SelectedDateProvider({ children }: { children: ReactNode }) {
  const [selectedDate, setSelectedDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));

  const resetToToday = () => setSelectedDate(format(new Date(), 'yyyy-MM-dd'));

  return (
    <SelectedDateContext.Provider value={{ selectedDate, setSelectedDate, resetToToday }}>
      {children}
    </SelectedDateContext.Provider>
  );
}

export function useSelectedDate() {
  const ctx = useContext(SelectedDateContext);
  if (!ctx) throw new Error('useSelectedDate must be used within SelectedDateProvider');
  return ctx;
}
