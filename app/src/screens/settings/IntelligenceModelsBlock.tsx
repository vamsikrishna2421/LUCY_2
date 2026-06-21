/**
 * IntelligenceModelsBlock — the "Intelligence & models" header block inside the AI & intelligence
 * group: one-tap presets, per-agent model pickers (Opus/Sonnet/Haiku chips, locked when LUCY-managed),
 * and the BYOK Anthropic-key field. Extracted from Settings.tsx to keep that orchestrator focused;
 * pure presentation over the `useSettings` seam — every action is a frozen-logic call on `s`.
 */
import React from 'react';
import { View } from 'react-native';
import { Text, Row, Stack, Spacer, Button, Chip, TextField, useTheme } from '../../ui';
import { ROLE_CARDS, MODEL_DISPLAY_ORDER, MODEL_PRESETS, roleChoice } from './models';
import type { ModelRole } from '../../ai/modelPreference';
import type { UseSettings } from '../hooks/useSettings';

export function IntelligenceModelsBlock({
  s, claudeKey, setClaudeKey, savingClaudeKey, onSaveKey,
}: {
  s: UseSettings;
  claudeKey: string;
  setClaudeKey: (v: string) => void;
  savingClaudeKey: boolean;
  onSaveKey: () => void;
}): React.ReactElement {
  const { spacing } = useTheme();
  const locked = s.tokenMode === 'managed';
  const activePreset = MODEL_PRESETS.find((p) =>
    (Object.keys(p.models) as ModelRole[]).every((r) => s.roleModels[r] === p.models[r]),
  )?.id ?? null;

  return (
    <View style={{ paddingHorizontal: spacing.base, paddingTop: spacing.sm }}>
      <Text variant="caption" color="accent" weight="700" tracking={1.2}>INTELLIGENCE & MODELS</Text>
      <Text variant="footnote" color="textMuted" style={{ marginTop: 2 }}>Pick which model powers each agent.</Text>
      <Spacer size="sm" />

      {/* Quick presets */}
      <Row gap="sm" wrap>
        {MODEL_PRESETS.map((p) => (
          <Chip key={p.id} label={p.label} selected={activePreset === p.id} disabled={locked} onPress={() => void s.selectPreset(p.models)} />
        ))}
      </Row>
      <Text variant="caption" color="textMuted" style={{ marginTop: spacing.sm }}>
        {MODEL_PRESETS.find((p) => p.id === activePreset)?.blurb ?? 'Custom mix — tap a preset, or fine-tune each agent below.'}
      </Text>

      {locked ? (
        <Row gap="sm" align="center" style={{ marginTop: spacing.sm }}>
          <Text variant="footnote">🔒</Text>
          <Text variant="footnote" color="textMuted">Managed by your Lucy plan for the best price.</Text>
        </Row>
      ) : null}

      {/* Per-agent role pickers */}
      <Spacer size="md" />
      <Stack gap="md">
        {ROLE_CARDS.map(({ role, title, desc, icon }) => (
          <View key={role}>
            <Row gap="sm" align="center">
              <Text variant="body">{icon}</Text>
              <View style={{ flex: 1 }}>
                <Text variant="footnote" weight="700">{title}</Text>
                <Text variant="caption" color="textMuted">{desc}</Text>
              </View>
            </Row>
            <Spacer size="xs" />
            <Row gap="sm" wrap>
              {MODEL_DISPLAY_ORDER.map((id) => (
                <Chip
                  key={id}
                  label={roleChoice(id)?.short ?? id}
                  selected={s.roleModels[role] === id}
                  disabled={locked}
                  onPress={() => void s.selectRoleModel(role, id)}
                />
              ))}
            </Row>
          </View>
        ))}
      </Stack>

      {/* BYOK Anthropic key */}
      <Spacer size="md" />
      <Text variant="footnote" weight="700">Your Anthropic key</Text>
      <Text variant="caption" color="textMuted">Bring your own key (BYOK){s.hasClaudeKey ? ' · saved' : ''}</Text>
      <Spacer size="sm" />
      <Row gap="sm" align="center">
        <View style={{ flex: 1 }}>
          <TextField
            placeholder={s.hasClaudeKey ? '••••••••••••••••' : 'sk-ant-...'}
            value={claudeKey}
            onChangeText={setClaudeKey}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        <Button
          label={s.hasClaudeKey && !claudeKey.trim() ? 'Remove' : 'Save'}
          variant={s.hasClaudeKey && !claudeKey.trim() ? 'danger' : 'primary'}
          size="sm"
          loading={savingClaudeKey}
          disabled={(!claudeKey.trim() && !s.hasClaudeKey) || savingClaudeKey}
          onPress={onSaveKey}
        />
      </Row>
    </View>
  );
}
