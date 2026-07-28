/**
 * CategoryPicker — horizontal scrollable category selector
 * Matches web's AddExpensePage category section exactly.
 */
import React from 'react';
import {
  ScrollView, TouchableOpacity, View, Text, StyleSheet,
} from 'react-native';
import { colors, fontSizes, fontWeights, radius, spacing } from '../theme';

interface Category {
  name: string;
  icon: string;
}

interface CategoryPickerProps {
  categories: Category[];
  selected: string;
  onSelect: (name: string) => void;
  onAddCategory: () => void;
}

export default function CategoryPicker({
  categories,
  selected,
  onSelect,
  onAddCategory,
}: CategoryPickerProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scroll}
    >
      {categories.map(cat => {
        const isSelected = selected === cat.name;
        return (
          <TouchableOpacity
            key={cat.name}
            onPress={() => onSelect(cat.name)}
            style={[styles.item, isSelected && styles.itemSelected]}
            activeOpacity={0.75}
          >
            <View style={[styles.iconCircle, isSelected && styles.iconCircleSelected]}>
              <Text style={styles.emoji}>{cat.icon}</Text>
            </View>
            <Text style={[styles.label, isSelected && styles.labelSelected]}>
              {cat.name}
            </Text>
          </TouchableOpacity>
        );
      })}

      {/* Add custom category button */}
      <TouchableOpacity
        onPress={onAddCategory}
        style={styles.item}
        activeOpacity={0.75}
      >
        <View style={styles.addCircle}>
          <Text style={styles.addIcon}>+</Text>
        </View>
        <Text style={styles.addLabel}>Add</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: spacing.pagePadding,
    paddingBottom: spacing.sm,
    gap: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  item: {
    alignItems: 'center',
    gap: 6,
    minWidth: 60,
    opacity: 0.7,
  },
  itemSelected: { opacity: 1, transform: [{ scale: 1.05 }] },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.bgSurfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleSelected: {
    backgroundColor: colors.primary,
  },
  emoji: { fontSize: 22 },
  label: {
    fontSize: fontSizes.xs,
    color: colors.onSurfaceVariant,
    fontWeight: fontWeights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  labelSelected: { color: colors.primary, fontWeight: fontWeights.bold },

  addCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: colors.primary + '66',
    borderStyle: 'dashed',
    backgroundColor: colors.primary + '0D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addIcon: {
    fontSize: 22,
    color: colors.primary,
    fontWeight: fontWeights.bold,
  },
  addLabel: {
    fontSize: fontSizes.xs,
    color: colors.primary,
    fontWeight: fontWeights.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
