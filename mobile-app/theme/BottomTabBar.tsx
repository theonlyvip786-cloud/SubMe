import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { colors, animation, tabBarMetrics } from './designSystem';

const BAR_HORIZONTAL_PADDING = 4;
const { indicatorSize, indicatorRadius } = tabBarMetrics;
const BAR_CONTENT_HEIGHT = tabBarMetrics.height - 16;
const INDICATOR_TOP = (BAR_CONTENT_HEIGHT - indicatorSize) / 2;

type TabIconConfig = {
  active: keyof typeof Ionicons.glyphMap;
  inactive: keyof typeof Ionicons.glyphMap;
};

const TAB_ICONS: Record<string, TabIconConfig> = {
  Home: { active: 'home', inactive: 'home-outline' },
  Wallet: { active: 'wallet', inactive: 'wallet-outline' },
  Refer: { active: 'swap-horizontal', inactive: 'swap-horizontal-outline' },
  Promote: { active: 'megaphone', inactive: 'megaphone-outline' },
  Profile: { active: 'person', inactive: 'person-outline' },
  Analytics: { active: 'grid', inactive: 'grid-outline' },
  Reviews: { active: 'eye', inactive: 'eye-outline' },
  Payments: { active: 'cash', inactive: 'cash-outline' },
  Tools: { active: 'construct', inactive: 'construct-outline' },
  Users: { active: 'people', inactive: 'people-outline' },
};

export default function CustomBottomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [barWidth, setBarWidth] = useState(Dimensions.get('window').width - 32);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const tabCount = state.routes.length;
  const innerWidth = Math.max(barWidth - BAR_HORIZONTAL_PADDING * 2, indicatorSize * tabCount);
  const tabSlotWidth = innerWidth / tabCount;
  const indicatorOffset = (tabSlotWidth - indicatorSize) / 2;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: state.index * tabSlotWidth + indicatorOffset,
      ...animation.spring.tab,
    }).start();
  }, [state.index, tabSlotWidth, indicatorOffset, slideAnim]);

  const bottomPad = Math.max(insets.bottom, 12);

  return (
    <View style={[styles.wrapper, { paddingBottom: bottomPad }]}>
      <View
        style={styles.bar}
        onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.indicator,
            {
              width: indicatorSize,
              height: indicatorSize,
              borderRadius: indicatorRadius,
              transform: [{ translateX: slideAnim }],
            },
          ]}
        />

        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;
          const iconSet = TAB_ICONS[route.name] || TAB_ICONS.Home;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const onLongPress = () => {
            navigation.emit({ type: 'tabLongPress', target: route.key });
          };

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              onPress={onPress}
              onLongPress={onLongPress}
              style={styles.tab}
              activeOpacity={0.85}
            >
              <View style={styles.iconSlot}>
                <TabIcon
                  name={isFocused ? iconSet.active : iconSet.inactive}
                  focused={isFocused}
                />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function TabIcon({ name, focused }: { name: keyof typeof Ionicons.glyphMap; focused: boolean }) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: focused ? 1.08 : 1,
      ...animation.spring.medium,
    }).start();
  }, [focused, scale]);

  return (
    <Animated.View style={[styles.iconInner, { transform: [{ scale }] }]}>
      <Ionicons
        name={name}
        size={22}
        color={focused ? colors.black : colors.textMuted}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.bgPrimary,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: BAR_CONTENT_HEIGHT,
    backgroundColor: colors.bgPrimary,
    borderRadius: tabBarMetrics.barRadius,
    paddingHorizontal: BAR_HORIZONTAL_PADDING,
  },
  indicator: {
    position: 'absolute',
    left: BAR_HORIZONTAL_PADDING,
    top: INDICATOR_TOP,
    backgroundColor: colors.lime,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: BAR_CONTENT_HEIGHT,
    zIndex: 1,
  },
  iconSlot: {
    width: indicatorSize,
    height: indicatorSize,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconInner: {
    width: indicatorSize,
    height: indicatorSize,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
      } as object,
    }),
  },
});
