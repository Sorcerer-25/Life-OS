import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { Icon, IconName } from './Icon';

export type AgentType = 'reminder' | 'calendar' | 'task' | 'inbox' | 'notification' | 'expense' | 'system';

interface IconTileProps {
  name?: IconName;
  agent?: AgentType;
  size?: number; // Size of the tile, default 34
  iconSize?: number; // Size of the icon inside, default 18
  color?: string; // Custom color override
  style?: ViewStyle;
}

const AGENT_CONFIG: Record<AgentType, { name: IconName; color: string }> = {
  reminder: { name: 'bell', color: '#FF9F43' },       // Orange
  calendar: { name: 'calendar', color: '#5AA9FF' },   // Blue
  task: { name: 'check-square', color: '#FF7A59' },    // Coral
  inbox: { name: 'inbox', color: '#B79CFF' },          // Violet
  notification: { name: 'inbox', color: '#B79CFF' },   // Violet
  expense: { name: 'dollar-sign', color: '#3DDC97' },  // Mint/Green
  system: { name: 'shield', color: '#8B95A5' },        // Muted Slate
};

export function hexToRgba(hex: string, opacity: number): string {
  const cleanHex = hex.replace('#', '');
  if (cleanHex.length === 6) {
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  return hex;
}

export const IconTile: React.FC<IconTileProps> = ({
  name,
  agent,
  size = 34,
  iconSize = 18,
  color,
  style,
}) => {
  const agentCfg = agent ? AGENT_CONFIG[agent] : null;
  const resolvedName: IconName = name || agentCfg?.name || 'help-circle';
  const resolvedColor = color || agentCfg?.color || '#F2F4F7';

  const backgroundColor = resolvedColor.startsWith('#')
    ? hexToRgba(resolvedColor, 0.15)
    : 'rgba(255, 255, 255, 0.1)';

  const borderColor = resolvedColor.startsWith('#')
    ? hexToRgba(resolvedColor, 0.25)
    : 'rgba(255, 255, 255, 0.15)';

  return (
    <View
      style={[
        styles.tile,
        {
          width: size,
          height: size,
          borderRadius: 8,
          backgroundColor,
          borderColor,
          borderWidth: 1,
        },
        style,
      ]}
    >
      <Icon name={resolvedName} size={iconSize} color={resolvedColor} />
    </View>
  );
};

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

