import React from 'react';
import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import { TextStyle } from 'react-native';

export type IconName =
  | 'calendar'
  | 'bell'
  | 'check-square'
  | 'inbox'
  | 'home'
  | 'clock'
  | 'settings'
  | 'mic'
  | 'mic-off'
  | 'plus'
  | 'zap'
  | 'search'
  | 'x'
  | 'chevron-down'
  | 'chevron-up'
  | 'chevron-right'
  | 'alert-triangle'
  | 'alert-circle'
  | 'check'
  | 'check-circle'
  | 'trash'
  | 'trash-2'
  | 'refresh-cw'
  | 'more-horizontal'
  | 'more-vertical'
  | 'external-link'
  | 'filter'
  | 'sun'
  | 'moon'
  | 'lock'
  | 'shield'
  | 'message-square'
  | 'dollar-sign'
  | 'eye'
  | 'eye-off'
  | 'copy'
  | 'info'
  | 'help-circle'
  | 'square'
  | 'arrow-right'
  | 'volume-2'
  | 'smartphone'
  | 'globe'
  | 'target'
  | 'cpu'
  | 'database';

export interface IconProps {
  name: IconName | string;
  size?: number; // Default 18 (inside cards), 22 (tab bar)
  color?: string;
  style?: TextStyle;
  filled?: boolean;
}

export const Icon: React.FC<IconProps> = ({
  name,
  size = 18,
  color = '#F2F4F7',
  style,
  filled = false,
}) => {
  if (filled) {
    const names = { home: 'home', inbox: 'file-tray', clock: 'time', settings: 'settings' } as const;
    const filledName = names[name as keyof typeof names];
    if (filledName) return <Ionicons name={filledName} size={size} color={color} style={style} />;
  }
  // Map friendly names to Feather icons
  switch (name) {
    case 'calendar':
      return <Feather name="calendar" size={size} color={color} style={style} />;
    case 'bell':
    case 'reminder':
      return <Feather name="bell" size={size} color={color} style={style} />;
    case 'check-square':
    case 'task':
      return <Feather name="check-square" size={size} color={color} style={style} />;
    case 'inbox':
    case 'notification':
      return <Feather name="inbox" size={size} color={color} style={style} />;
    case 'home':
      return <Feather name="home" size={size} color={color} style={style} />;
    case 'clock':
    case 'activity':
      return <Feather name="clock" size={size} color={color} style={style} />;
    case 'settings':
      return <Feather name="settings" size={size} color={color} style={style} />;
    case 'mic':
      return <Feather name="mic" size={size} color={color} style={style} />;
    case 'mic-off':
      return <Feather name="mic-off" size={size} color={color} style={style} />;
    case 'plus':
      return <Feather name="plus" size={size} color={color} style={style} />;
    case 'zap':
      return <Feather name="zap" size={size} color={color} style={style} />;
    case 'search':
      return <Feather name="search" size={size} color={color} style={style} />;
    case 'x':
    case 'close':
      return <Feather name="x" size={size} color={color} style={style} />;
    case 'chevron-down':
      return <Feather name="chevron-down" size={size} color={color} style={style} />;
    case 'chevron-up':
      return <Feather name="chevron-up" size={size} color={color} style={style} />;
    case 'chevron-right':
      return <Feather name="chevron-right" size={size} color={color} style={style} />;
    case 'alert-triangle':
    case 'warning':
      return <Feather name="alert-triangle" size={size} color={color} style={style} />;
    case 'alert-circle':
    case 'error':
      return <Feather name="alert-circle" size={size} color={color} style={style} />;
    case 'check':
      return <Feather name="check" size={size} color={color} style={style} />;
    case 'check-circle':
    case 'success':
      return <Feather name="check-circle" size={size} color={color} style={style} />;
    case 'trash':
    case 'trash-2':
      return <Feather name="trash-2" size={size} color={color} style={style} />;
    case 'refresh-cw':
    case 'refresh':
      return <Feather name="refresh-cw" size={size} color={color} style={style} />;
    case 'more-horizontal':
    case 'more':
      return <Feather name="more-horizontal" size={size} color={color} style={style} />;
    case 'more-vertical':
      return <Feather name="more-vertical" size={size} color={color} style={style} />;
    case 'external-link':
      return <Feather name="external-link" size={size} color={color} style={style} />;
    case 'filter':
      return <Feather name="filter" size={size} color={color} style={style} />;
    case 'sun':
      return <Feather name="sun" size={size} color={color} style={style} />;
    case 'moon':
      return <Feather name="moon" size={size} color={color} style={style} />;
    case 'lock':
      return <Feather name="lock" size={size} color={color} style={style} />;
    case 'shield':
      return <Feather name="shield" size={size} color={color} style={style} />;
    case 'message-square':
      return <Feather name="message-square" size={size} color={color} style={style} />;
    case 'dollar-sign':
    case 'expense':
      return <Feather name="dollar-sign" size={size} color={color} style={style} />;
    case 'copy':
      return <Feather name="copy" size={size} color={color} style={style} />;
    case 'info':
      return <Feather name="info" size={size} color={color} style={style} />;
    case 'help-circle':
      return <Feather name="help-circle" size={size} color={color} style={style} />;
    case 'square':
      return <Feather name="square" size={size} color={color} style={style} />;
    case 'arrow-right':
      return <Feather name="arrow-right" size={size} color={color} style={style} />;
    case 'volume-2':
      return <Feather name="volume-2" size={size} color={color} style={style} />;
    default:
      // Try feather by default
      return <Feather name={(name as any) || 'help-circle'} size={size} color={color} style={style} />;
  }
};

