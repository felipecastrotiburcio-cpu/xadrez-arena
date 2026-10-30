import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius } from './theme';

type Kind = 'info' | 'success' | 'error';
interface Toast {
  id: number;
  text: string;
  kind: Kind;
}

const ToastContext = createContext<(text: string, kind?: Kind) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const insets = useSafeAreaInsets();

  const show = useCallback((text: string, kind: Kind = 'info') => {
    const id = nextId.current++;
    setToasts((t) => [...t.slice(-2), { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <View pointerEvents="none" style={[styles.container, { bottom: insets.bottom + 24 }]}>
        {toasts.map((t) => (
          <View
            key={t.id}
            style={[styles.toast, t.kind === 'error' && styles.error, t.kind === 'success' && styles.success]}
          >
            <Text style={styles.text}>{t.text}</Text>
          </View>
        ))}
      </View>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

const styles = StyleSheet.create({
  container: { position: 'absolute', left: 16, right: 16, alignItems: 'center', gap: 8 },
  toast: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: 480,
  },
  error: { borderColor: colors.danger },
  success: { borderColor: colors.success },
  text: { color: colors.text, fontSize: 15, textAlign: 'center' },
});
