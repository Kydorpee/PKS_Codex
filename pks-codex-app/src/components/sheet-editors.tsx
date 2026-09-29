/**
 * Editores da ficha do Codex (feitos pelo Mestre): barras (vida, mana, estamina), status base
 * e status de ação calculados por fórmula.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { newId } from '@/lib/ids';
import { PIXEL_SHAPES, toShape } from '@/lib/pixel-shapes';
import { formulaText, resourcesOf } from '@/lib/rules';
import { colors, radius, spacing } from '@/lib/theme';
import type { ActionStatDef, BaseStatDef, CharacterSheet, FormulaOp, FormulaTerm, ResourceDef } from '@/lib/types';
import { useT } from '@/lib/i18n';
import { Input, RemoveButton, toInt } from './editors';
import { PixelIcon } from './pixel-icon';
import { Button, Muted, SectionHeader } from './ui';

/** Número opcional: campo vazio = sem valor (o padrão é usado). */
const toOptionalInt = (v: string) => (v.trim() === '' ? undefined : toInt(v));
const showOptional = (v: number | undefined) => (v === undefined ? '' : String(v));

export const BAR_COLORS = ['#8A1519', '#C62828', '#E0701A', '#A8651A', '#B8860B', '#2E6B2A', '#1565C0', '#2D5C9A', '#7B2FBE', '#6C7A86'];

const OPS: FormulaOp[] = ['+', '-', '×', '÷'];

/** Caixa de marcar com texto (ex.: "Usar esta barra"). */
function Toggle({ label, checked, onToggle, disabled }: { label: string; checked: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={onToggle}
      style={[styles.toggle, disabled && { opacity: 0.6 }]}
    >
      <View style={[styles.checkbox, checked && styles.checkboxOn]}>{checked && <Text style={styles.checkMark}>✓</Text>}</View>
      <Text style={styles.toggleText}>{label}</Text>
    </Pressable>
  );
}

function Chip({ label, active, onPress, color }: { label: string; active: boolean; onPress: () => void; color?: string }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, color ? { color } : null, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

/** Uma barra do personagem: ligar/desligar, nome (sem sigla), valor inicial, cor e ícone. */
export function ResourceEditor({ value, onChange }: { value: ResourceDef; onChange: (v: ResourceDef) => void }) {
  const { t } = useT();
  const set = (patch: Partial<ResourceDef>) => onChange({ ...value, ...patch });
  const life = value.key === 'hp';
  const role = life ? t('Quem chega a 0 cai em batalha.') : value.key === 'mana' ? t('Paga as habilidades mágicas.') : t('Paga as habilidades físicas.');
  return (
    <View style={[styles.box, !value.enabled && { opacity: 0.7 }]}>
      <View style={styles.inline}>
        <PixelIcon shape={toShape(value.icon)} color={value.color} pixel={3} />
        <View style={{ flex: 1 }}>
          <Toggle
            label={life ? t('Barra obrigatória') : t('Usar esta barra')}
            checked={value.enabled}
            disabled={life}
            onToggle={() => set({ enabled: !value.enabled })}
          />
          <Text style={styles.miniLabel}>{role}</Text>
        </View>
      </View>
      {value.enabled && (
        <>
          <View style={styles.inline}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.miniLabel}>{t('Nome (obrigatório)')}</Text>
              <Input placeholder={t('Ex.: Vida')} value={value.name} onChangeText={(name) => set({ name })} />
            </View>
            <View style={{ width: 80, gap: 2 }}>
              <Text style={styles.miniLabel}>{t('Máximo')}</Text>
              <Input
                placeholder={t('Padrão')}
                keyboardType="number-pad"
                value={showOptional(value.base)}
                onChangeText={(v) => set({ base: toOptionalInt(v) })}
              />
            </View>
          </View>
          <Text style={styles.miniLabel}>{t('Cor da barra')}</Text>
          <View style={styles.wrap}>
            {BAR_COLORS.map((color) => (
              <Pressable
                key={color}
                accessibilityRole="radio"
                accessibilityLabel={color}
                accessibilityState={{ selected: value.color === color }}
                onPress={() => set({ color })}
                style={[styles.swatch, { backgroundColor: color }, value.color === color && styles.swatchActive]}
              />
            ))}
          </View>
          <Text style={styles.miniLabel}>{t('Ícone')}</Text>
          <View style={styles.wrap}>
            {PIXEL_SHAPES.map((shape) => (
              <Pressable
                key={shape}
                accessibilityRole="radio"
                accessibilityLabel={shape}
                accessibilityState={{ selected: value.icon === shape }}
                onPress={() => set({ icon: shape })}
                style={[styles.iconChoice, value.icon === shape && styles.chipActive]}
              >
                <PixelIcon shape={shape} color={value.color} />
              </Pressable>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

/** Status base (Força, Movimento...): nome, sigla e valor inicial. */
export function BaseStatListEditor({ value, onChange }: { value: BaseStatDef[]; onChange: (v: BaseStatDef[]) => void }) {
  const { t } = useT();
  const update = (id: string, patch: Partial<BaseStatDef>) => onChange(value.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  return (
    <View style={styles.list}>
      <SectionHeader
        title={t('Status base')}
        action={
          <Button
            small
            variant="secondary"
            title={t('+ Adicionar')}
            onPress={() => onChange([...value, { id: newId(), name: '', abbr: '', editable: false }])}
          />
        }
      />
      <Muted>{t('Valores guardados na ficha (ex.: Força, Movimento). Valor vazio = 10. A sigla é usada nas fórmulas; a ficha mostra o nome completo.')}</Muted>
      {value.map((s) => (
        <View key={s.id} style={styles.box}>
          <View style={styles.inline}>
            <Input style={{ flex: 1 }} placeholder={t('Nome (ex.: Força)')} value={s.name} onChangeText={(name) => update(s.id, { name })} />
            <Input
              style={styles.short}
              placeholder={t('Sigla')}
              autoCapitalize="characters"
              maxLength={4}
              value={s.abbr}
              onChangeText={(abbr) => update(s.id, { abbr })}
            />
            <Input
              style={styles.short}
              placeholder={t('Valor')}
              keyboardType="number-pad"
              value={showOptional(s.base)}
              onChangeText={(v) => update(s.id, { base: toOptionalInt(v) })}
            />
            <RemoveButton onPress={() => onChange(value.filter((x) => x.id !== s.id))} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Regra "Jogador edita status": quais barras (máximo) e status base o jogador pode definir. */
export function PlayerEditPicker({ sheet, onChange }: { sheet: CharacterSheet; onChange: (patch: Partial<CharacterSheet>) => void }) {
  const { t } = useT();
  const resources = resourcesOf({ sheet });
  const label = (name: string, abbr: string) => (abbr ? `${t(name)} (${abbr})` : t(name));
  const bars = resources.filter((r) => r.enabled);
  const stats = sheet.baseStats.filter((s) => s.name.trim());
  if (bars.length === 0 && stats.length === 0) return null;
  return (
    <View style={styles.box}>
      <Text style={styles.miniLabel}>{t('Marque o que o jogador pode definir na ficha do personagem.')}</Text>
      {bars.map((r) => (
        <Toggle
          key={r.key}
          label={t('{pool} máxima', { pool: t(r.name) })}
          checked={r.editable}
          onToggle={() => onChange({ resources: resources.map((x) => (x.key === r.key ? { ...x, editable: !x.editable } : x)) })}
        />
      ))}
      {stats.map((s) => (
        <Toggle
          key={s.id}
          label={label(s.name, s.abbr)}
          checked={s.editable}
          onToggle={() => onChange({ baseStats: sheet.baseStats.map((x) => (x.id === s.id ? { ...x, editable: !x.editable } : x)) })}
        />
      ))}
    </View>
  );
}

/** Uma parte da fórmula: operação (menos no primeiro termo) e um status base ou um número. */
function TermEditor({
  term,
  first,
  stats,
  onChange,
  onRemove,
}: {
  term: FormulaTerm;
  first: boolean;
  stats: BaseStatDef[];
  onChange: (v: FormulaTerm) => void;
  onRemove: () => void;
}) {
  const { t } = useT();
  const isNumber = !term.statId;
  return (
    <View style={styles.term}>
      <View style={[styles.inline, { alignItems: 'center' }]}>
        {!first && (
          <View style={styles.wrap}>
            {OPS.map((op) => (
              <Chip key={op} label={op} active={term.op === op} onPress={() => onChange({ ...term, op })} />
            ))}
          </View>
        )}
        <View style={{ flex: 1 }} />
        <RemoveButton onPress={onRemove} />
      </View>
      <View style={styles.wrap}>
        {stats.map((s) => (
          <Chip key={s.id} label={s.abbr || s.name || '?'} active={term.statId === s.id} onPress={() => onChange({ op: term.op, statId: s.id })} />
        ))}
        <Chip label={t('Número')} active={isNumber} onPress={() => onChange({ op: term.op, value: term.value ?? 1 })} />
      </View>
      {isNumber && (
        <Input
          keyboardType="number-pad"
          value={String(term.value ?? 0)}
          onChangeText={(v) => onChange({ op: term.op, value: toInt(v) })}
        />
      )}
    </View>
  );
}

/** Status de ação (Poder de ataque...): nome, sigla e a fórmula com os status base. */
export function ActionStatListEditor({
  value,
  stats,
  onChange,
}: {
  value: ActionStatDef[];
  stats: BaseStatDef[];
  onChange: (v: ActionStatDef[]) => void;
}) {
  const { t } = useT();
  const update = (id: string, patch: Partial<ActionStatDef>) => onChange(value.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  const firstTerm = (): FormulaTerm => (stats[0] ? { op: '+', statId: stats[0].id } : { op: '+', value: 1 });
  return (
    <View style={styles.list}>
      <SectionHeader
        title={t('Status de ação')}
        action={
          <Button
            small
            variant="secondary"
            title={t('+ Adicionar')}
            onPress={() => onChange([...value, { id: newId(), name: '', abbr: '', terms: [firstTerm()] }])}
          />
        }
      />
      <Muted>{t('Calculados a partir dos status base, da esquerda para a direita. Ex.: Poder de ataque (PA) = FA + MV. Os jogadores veem só o resultado, não a fórmula.')}</Muted>
      {value.map((a) => (
        <View key={a.id} style={styles.box}>
          <View style={styles.inline}>
            <Input style={{ flex: 1 }} placeholder={t('Nome (ex.: Poder de ataque)')} value={a.name} onChangeText={(name) => update(a.id, { name })} />
            <Input
              style={styles.short}
              placeholder={t('Sigla')}
              autoCapitalize="characters"
              maxLength={4}
              value={a.abbr}
              onChangeText={(abbr) => update(a.id, { abbr })}
            />
            <RemoveButton onPress={() => onChange(value.filter((x) => x.id !== a.id))} />
          </View>
          <Text style={styles.formula}>
            {a.abbr || a.name || '?'} = {a.terms.length ? formulaText(a, stats) : '…'}
          </Text>
          {a.terms.map((term, i) => (
            <TermEditor
              key={i}
              term={term}
              first={i === 0}
              stats={stats}
              onChange={(next) => update(a.id, { terms: a.terms.map((x, j) => (j === i ? next : x)) })}
              onRemove={() => update(a.id, { terms: a.terms.filter((_, j) => j !== i) })}
            />
          ))}
          <Button small variant="secondary" title={t('+ Termo')} onPress={() => update(a.id, { terms: [...a.terms, firstTerm()] })} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  box: {
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.goldDim,
    padding: spacing.md,
  },
  term: { gap: spacing.xs, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  inline: { flexDirection: 'row', gap: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  short: { width: 72, textAlign: 'center' },
  miniLabel: { color: colors.textMuted, fontSize: 12 },
  formula: { color: colors.primary, fontSize: 16, fontWeight: '700' },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 2 },
  toggleText: { color: colors.text, fontSize: 14, fontWeight: '600', flexShrink: 1 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.goldDim,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkMark: { color: colors.onPrimary, fontSize: 14, fontWeight: '800' },
  chip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  chipActive: { borderColor: colors.goldDim, backgroundColor: colors.gold },
  chipText: { color: colors.textMuted, fontWeight: '700' },
  chipTextActive: { color: colors.text },
  swatch: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: 'transparent' },
  swatchActive: { borderColor: colors.text, transform: [{ scale: 1.1 }] },
  iconChoice: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
