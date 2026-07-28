import React from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TopBar from '../TopBar';
import { colors } from '../../theme';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  showBack?: boolean;
  rightSlot?: React.ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
}

export default function Layout({
  children,
  title,
  showBack,
  rightSlot,
  onRefresh,
  refreshing = false,
}: LayoutProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <TopBar title={title} showBack={showBack} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 110 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.secondary]}
              tintColor={colors.secondary}
            />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: 20, // matches web's px-container-padding (20px)
    paddingTop: 24,        // matches web's py-stack-md (24px)
    gap: 24,                // matches web's gap-stack-md (24px)
  },
});
