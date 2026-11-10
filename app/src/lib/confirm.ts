import { Alert, Platform } from 'react-native';
import { tStatic } from './i18n';

/** Pede confirmação (Alert no celular, confirm() na web). */
export function confirmAction(title: string, message: string, onConfirm: () => void, confirmText = tStatic('common.confirm')) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`${title}\n${message}`) ?? true) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: tStatic('common.cancel'), style: 'cancel' },
    { text: confirmText, style: 'default', onPress: onConfirm },
  ]);
}
