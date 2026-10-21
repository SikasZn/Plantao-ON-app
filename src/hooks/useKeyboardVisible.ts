// src/hooks/useKeyboardVisible.ts
import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

// true enquanto o teclado está aberto. Usado pra tirar a margem da barra de
// navegação do Android dos modais quando o teclado já cobre essa área.
export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const a = Keyboard.addListener(showEvent, () => setVisible(true));
    const b = Keyboard.addListener(hideEvent, () => setVisible(false));
    return () => {
      a.remove();
      b.remove();
    };
  }, []);
  return visible;
}
