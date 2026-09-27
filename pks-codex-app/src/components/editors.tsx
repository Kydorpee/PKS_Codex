import type { ComponentProps } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { newId } from '@/lib/ids';
import { pickPhoto, SMALL_PHOTO } from '@/lib/photos';
import { colors, radius, spacing } from '@/lib/theme';
import { STATUS_INFO, STATUS_TYPES } from '@/lib/rules';
import type { Ability, AbilityKind, Attribute, Item, Mount, ShopItem, StatusType } from '@/lib/types';
import { BlastIcon, CostIcon } from './monster-stats';
import { Avatar, Button, SectionHeader } from './ui';

/** Converte texto digitado em número inteiro não negativo. */
export const toInt = (value: string) => Math.max(0, parseInt(value.replace(/\D/g, ''), 10) || 0);

function Input(props: ComponentProps<typeof TextInput>) {
  return <TextInput placeholderTextColor={colors.textMuted} {...props} style={[styles.input, props.style]} />;
}

function RemoveButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable accessibilityLabel="Remover" hitSlop={8} onPress={onPress} style={styles.remove}>
      <Text style={styles.removeText}>✕</Text>
    </Pressable>
  );
}

export function PhotoField({
  uri,
  emoji,
  name,
  onPick,
  onRemove,
}: {
  uri?: string;
  emoji?: string;
  name?: string;
  onPick: () => void;
  onRemove: () => void;
}) {
  return (
    <View style={styles.photoRow}>
      <Avatar uri={uri} emoji={emoji} name={name} size={88} />
      <View style={{ flex: 1, gap: spacing.sm }}>
        <Button small variant="secondary" title={uri ? 'Trocar foto' : 'Escolher foto'} onPress={onPick} />
        {uri && <Button small variant="ghost" title="Remover foto" onPress={onRemove} />}
      </View>
    </View>
  );
}

/**
 * Miniatura quadrada de foto: toque para escolher da galeria (foto pequena, para caber no Codex);
 * o ✕ remove. Usada em habilidades, itens, itens de loja e montarias.
 */
export function PhotoThumb({ uri, onChange, size = 56, placeholder = '📷' }: { uri?: string; onChange: (uri?: string) => void; size?: number; placeholder?: string }) {
  const pick = async () => {
    const photo = await pickPhoto(SMALL_PHOTO);
    if (photo) onChange(photo);
  };
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={uri ? 'Trocar foto' : 'Adicionar foto'}
        onPress={pick}
        style={[styles.thumb, { width: size, height: size }]}
      >
        {uri ? <Image source={{ uri }} style={{ width: '100%', height: '100%' }} /> : <Text style={{ fontSize: size * 0.4 }}>{placeholder}</Text>}
      </Pressable>
      {uri && (
        <Pressable accessibilityLabel="Remover foto" hitSlop={8} onPress={() => onChange(undefined)} style={styles.thumbRemove}>
          <Text style={styles.thumbRemoveText}>✕</Text>
        </Pressable>
      )}
    </View>
  );
}

export const emptyAbility = (): Ability => ({ id: newId(), name: '', description: '', kind: 'fisica', cost: 0, baseDamage: '' });

const KINDS: { kind: AbilityKind; label: string }[] = [
  { kind: 'fisica', label: 'Física' },
  { kind: 'magica', label: 'Mágica' },
];

/** Campos de uma habilidade: nome, tipo, custo (mana/estamina), dano base e descrição. */
export function AbilityFields<T extends Ability>({ value, onChange }: { value: T; onChange: (v: T) => void }) {
  const set = (patch: Partial<Ability>) => onChange({ ...value, ...patch });
  return (
    <View style={styles.rowFields}>
      <View style={[styles.inline, { alignItems: 'center' }]}>
        <PhotoThumb uri={value.photoUri} onChange={(photoUri) => set({ photoUri })} placeholder="✨" />
        <Input style={{ flex: 1 }} placeholder="Nome da habilidade" value={value.name} onChangeText={(name) => set({ name })} />
      </View>
      <View style={styles.inline}>
        {KINDS.map(({ kind, label }) => (
          <Pressable
            key={kind}
            accessibilityRole="radio"
            accessibilityState={{ selected: value.kind === kind }}
            onPress={() => set({ kind })}
            style={[styles.chip, styles.kindChip, value.kind === kind && styles.chipActive]}
          >
            <CostIcon kind={kind} />
            <Text style={[styles.chipText, value.kind === kind && styles.chipTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.inline}>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={styles.labelRow}>
            <CostIcon kind={value.kind} />
            <Text style={styles.miniLabel}>Custo de {value.kind === 'magica' ? 'mana' : 'estamina'}</Text>
          </View>
          <Input keyboardType="number-pad" value={String(value.cost)} onChangeText={(v) => set({ cost: toInt(v) })} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={styles.labelRow}>
            <BlastIcon />
            <Text style={styles.miniLabel}>Dano base</Text>
          </View>
          <Input placeholder="Ex.: 2d6 + 3" value={value.baseDamage} onChangeText={(baseDamage) => set({ baseDamage })} />
        </View>
      </View>
      <Text style={styles.miniLabel}>Status que pode causar (o sistema sorteia a chance)</Text>
      <View style={styles.wrap}>
        {[undefined, ...STATUS_TYPES].map((status: StatusType | undefined) => {
          const active = value.status === status;
          return (
            <Pressable
              key={status ?? 'nenhum'}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              onPress={() => set({ status, statusChance: status ? value.statusChance || 25 : undefined })}
              style={[styles.chip, styles.chipSmall, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, status && { color: STATUS_INFO[status].color }, active && styles.chipTextActive]}>
                {status ? `${STATUS_INFO[status].emoji} ${STATUS_INFO[status].label}` : 'Nenhum'}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {value.status && (
        <View style={{ gap: 2 }}>
          <Text style={[styles.miniLabel, { color: STATUS_INFO[value.status].color }]}>
            Chance de {STATUS_INFO[value.status].label.toLowerCase()} (%) — {STATUS_INFO[value.status].effect}
          </Text>
          <Input
            keyboardType="number-pad"
            value={String(value.statusChance ?? 0)}
            onChangeText={(v) => set({ statusChance: Math.min(100, toInt(v)) })}
          />
        </View>
      )}
      <Input placeholder="Descrição / efeito" multiline value={value.description} onChangeText={(description) => set({ description })} />
    </View>
  );
}

export function AbilityListEditor({ value, onChange }: { value: Ability[]; onChange: (v: Ability[]) => void }) {
  return (
    <View style={styles.list}>
      <SectionHeader
        title="Habilidades"
        action={<Button small variant="secondary" title="+ Adicionar" onPress={() => onChange([...value, emptyAbility()])} />}
      />
      {value.map((a) => (
        <View key={a.id} style={styles.row}>
          <AbilityFields value={a} onChange={(next) => onChange(value.map((x) => (x.id === a.id ? next : x)))} />
          <RemoveButton onPress={() => onChange(value.filter((x) => x.id !== a.id))} />
        </View>
      ))}
    </View>
  );
}

export type ItemSuggestion = { name: string; description: string };

export function ItemListEditor({
  title,
  value,
  onChange,
  suggestions,
}: {
  title: string;
  value: Item[];
  onChange: (v: Item[]) => void;
  /** Itens prontos: tocar adiciona à lista (ou soma 1 se já estiver nela). */
  suggestions?: ItemSuggestion[];
}) {
  const update = (id: string, patch: Partial<Item>) => onChange(value.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const pick = (s: ItemSuggestion) => {
    const key = s.name.trim().toLowerCase();
    const existing = value.find((i) => i.name.trim().toLowerCase() === key);
    if (existing) update(existing.id, { quantity: existing.quantity + 1 });
    else onChange([...value, { id: newId(), name: s.name, quantity: 1, description: s.description }]);
  };
  return (
    <View style={styles.list}>
      <SectionHeader
        title={title}
        action={<Button small variant="secondary" title="+ Adicionar" onPress={() => onChange([...value, { id: newId(), name: '', quantity: 1, description: '' }])} />}
      />
      {!!suggestions?.length && (
        <View style={styles.wrap}>
          {suggestions.map((s) => (
            <Pressable key={s.name} accessibilityRole="button" onPress={() => pick(s)} style={[styles.chip, styles.chipSmall]}>
              <Text style={styles.chipText}>+ {s.name}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {value.map((i) => (
        <View key={i.id} style={styles.row}>
          <PhotoThumb uri={i.photoUri} onChange={(photoUri) => update(i.id, { photoUri })} placeholder="🎒" />
          <View style={styles.rowFields}>
            <View style={styles.inline}>
              <Input style={{ flex: 1 }} placeholder="Nome do item" value={i.name} onChangeText={(name) => update(i.id, { name })} />
              <Input
                style={styles.number}
                placeholder="Qtd"
                keyboardType="number-pad"
                value={String(i.quantity)}
                onChangeText={(v) => update(i.id, { quantity: toInt(v) })}
              />
            </View>
            <Input placeholder="Descrição" value={i.description} onChangeText={(description) => update(i.id, { description })} />
          </View>
          <RemoveButton onPress={() => onChange(value.filter((x) => x.id !== i.id))} />
        </View>
      ))}
    </View>
  );
}

/** Atributos com nome e valor livres: cada Codex tem os seus (Força, Destreza, Vitalidade...). */
export function AttributeListEditor({ value, onChange }: { value: Attribute[]; onChange: (v: Attribute[]) => void }) {
  const update = (id: string, patch: Partial<Attribute>) => onChange(value.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  return (
    <View style={styles.list}>
      <SectionHeader
        title="Atributos"
        action={<Button small variant="secondary" title="+ Adicionar" onPress={() => onChange([...value, { id: newId(), name: '', value: 10 }])} />}
      />
      {value.map((a) => (
        <View key={a.id} style={[styles.row, styles.attributeRow]}>
          <Input style={{ flex: 1 }} placeholder="Ex.: Força" value={a.name} onChangeText={(name) => update(a.id, { name })} />
          <Input
            style={styles.number}
            placeholder="Valor"
            keyboardType="number-pad"
            value={String(a.value)}
            onChangeText={(v) => update(a.id, { value: toInt(v) })}
          />
          <RemoveButton onPress={() => onChange(value.filter((x) => x.id !== a.id))} />
        </View>
      ))}
    </View>
  );
}

/** Itens à venda num local. `mounts`: montarias do Codex que podem ser postas à venda. */
export function ShopItemListEditor({ value, onChange, mounts = [] }: { value: ShopItem[]; onChange: (v: ShopItem[]) => void; mounts?: Mount[] }) {
  const update = (id: string, patch: Partial<ShopItem>) => onChange(value.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const forSale = mounts.filter((m) => !value.some((i) => i.mountId === m.id));
  const sellMount = (m: Mount) =>
    onChange([...value, { id: newId(), name: m.name, price: 100, description: m.description, mountId: m.id, ...(m.photoUri ? { photoUri: m.photoUri } : {}) }]);
  return (
    <View style={styles.list}>
      <SectionHeader
        title="Itens à venda"
        action={<Button small variant="secondary" title="+ Adicionar" onPress={() => onChange([...value, { id: newId(), name: '', price: 0, description: '' }])} />}
      />
      {forSale.length > 0 && (
        <View style={styles.wrap}>
          {forSale.map((m) => (
            <Pressable key={m.id} accessibilityRole="button" onPress={() => sellMount(m)} style={[styles.chip, styles.chipSmall]}>
              <Text style={styles.chipText}>+ {m.emoji} {m.name} (montaria)</Text>
            </Pressable>
          ))}
        </View>
      )}
      {value.map((i) => (
        <View key={i.id} style={styles.row}>
          {i.mountId ? (
            <View style={[styles.thumb, { width: 56, height: 56 }]}>
              {i.photoUri ? <Image source={{ uri: i.photoUri }} style={{ width: '100%', height: '100%' }} /> : <Text style={{ fontSize: 22 }}>🐎</Text>}
            </View>
          ) : (
            <PhotoThumb uri={i.photoUri} onChange={(photoUri) => update(i.id, { photoUri })} placeholder="🗡️" />
          )}
          <View style={styles.rowFields}>
            {i.mountId && <Text style={styles.miniLabel}>🐎 Montaria: comprar dá a montaria (nome e foto vêm dela)</Text>}
            <View style={styles.inline}>
              <Input
                style={{ flex: 1 }}
                placeholder="Nome do item"
                editable={!i.mountId}
                value={i.name}
                onChangeText={(name) => update(i.id, { name })}
              />
              <Input
                style={styles.number}
                placeholder="Preço"
                keyboardType="number-pad"
                value={String(i.price)}
                onChangeText={(v) => update(i.id, { price: toInt(v) })}
              />
            </View>
            <Input placeholder="Descrição" value={i.description} onChangeText={(description) => update(i.id, { description })} />
          </View>
          <RemoveButton onPress={() => onChange(value.filter((x) => x.id !== i.id))} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  thumb: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.goldDim,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbRemoveText: { color: colors.onPrimary, fontSize: 11, fontWeight: '800' },
  list: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.goldDim,
    padding: spacing.md,
  },
  rowFields: { flex: 1, gap: spacing.sm },
  attributeRow: { alignItems: 'center' },
  inline: { flexDirection: 'row', gap: spacing.sm },
  input: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  number: { width: 72, textAlign: 'center' },
  chip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  kindChip: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  chipSmall: { flex: 0, paddingHorizontal: spacing.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chipActive: { borderColor: colors.goldDim, backgroundColor: colors.gold },
  chipText: { color: colors.textMuted, fontWeight: '600' },
  chipTextActive: { color: colors.text },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  miniLabel: { color: colors.textMuted, fontSize: 12 },
  remove: { paddingHorizontal: spacing.xs, paddingTop: spacing.sm },
  removeText: { color: colors.danger, fontSize: 18, fontWeight: '700' },
});
