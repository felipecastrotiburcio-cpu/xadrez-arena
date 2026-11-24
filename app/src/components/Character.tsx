import { Image, View } from 'react-native';
import { colors } from '../lib/theme';
import { CHARACTER_IMAGES } from './characterImages';
import { Icon } from './Icon';

/**
 * Miniatura do boneco: foto gerada a partir do próprio modelo 3D (leve para listas e
 * usada também quando o aparelho não consegue desenhar em 3D). A versão evoluída tem
 * foto própria, com a roupa nova e o item especial.
 */
export function CharacterThumb({ look, size }: { look: { id?: string; evolution?: string }; size: number }) {
  const src = look.id ? (look.evolution && CHARACTER_IMAGES[`${look.id}_evo`]) || CHARACTER_IMAGES[look.id] : undefined;
  if (!src) {
    return (
      <View style={{ width: size * 0.8, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="user" size={size * 0.5} color={colors.textMuted} />
      </View>
    );
  }
  return <Image source={src} style={{ width: size * 0.8, height: size }} resizeMode="contain" accessibilityIgnoresInvertColors />;
}
