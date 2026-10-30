import { Alert, Platform } from 'react-native';

/** Pede confirmação (Alert no celular, confirm() na web). */
export function confirmAction(title: string, message: string, onConfirm: () => void, confirmText = 'Confirmar') {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`${title}\n${message}`) ?? true) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancelar', style: 'cancel' },
    { text: confirmText, style: 'default', onPress: onConfirm },
  ]);
}
