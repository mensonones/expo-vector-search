// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolViewProps, SymbolWeight } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconMapping = Record<SymbolViewProps['name'], ComponentProps<typeof MaterialIcons>['name']>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'paintpalette.fill': 'palette',
  'cart.fill': 'shopping-cart',
  'wrench.and.screwdriver.fill': 'build',
  'bolt.fill': 'bolt',
  'tag.fill': 'local-offer',
  'cursorarrow.click': 'touch-app',
  'star.fill': 'star',
  'arrow.triangle.2.circlepath': 'refresh',
  'checkmark.circle.fill': 'check-circle',
  'xmark.circle.fill': 'cancel',
  'circle': 'radio-button-unchecked',
  'checkmark.seal.fill': 'verified',
  'magnifyingglass': 'search',
  'arrow.backward': 'arrow-back',
  'gear': 'settings',
  'square.and.arrow.up': 'file-upload',
  'square.and.arrow.down': 'save',
  'sparkles': 'auto-awesome',
  'bolt.shield.fill': 'bolt',
} as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
