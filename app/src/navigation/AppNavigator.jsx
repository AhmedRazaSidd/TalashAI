import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import SCREENS from '../constants/screenNames';
import SplashScreen from '../screens/SplashScreen';
import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import HomeScreen from '../screens/HomeScreen';
import CreateCaseScreen from '../screens/CreateCaseScreen';
import ChatScreen from '../screens/ChatScreen';
import ProfileScreen from '../screens/ProfileScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import ChatDetailsScreen from '../screens/ChatDetailsScreen';
import ArchiveScreen from '../screens/ArchiveScreen';
import LawyerProfileScreen from '../screens/LawyerProfileScreen';
import LawyerListScreen from '../screens/LawyerListScreen';
import SecuritySettingsScreen from '../screens/SecuritySettingsScreen';
import SupportScreen from '../screens/SupportScreen';
import SubscriptionPlansScreen from '../screens/SubscriptionPlansScreen';
import colors from '../theme/colors';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const MainTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 60,
          paddingBottom: 10,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,
      }}
    >
      <Tab.Screen
        name={SCREENS.HOME}
        component={HomeScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>🏠</Text>,
        }}
      />
      <Tab.Screen
        name={SCREENS.LAWYER_LIST}
        component={LawyerListScreen}
        options={{
          tabBarLabel: 'Explore',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>🔍</Text>,
        }}
      />
      <Tab.Screen
        name={SCREENS.ARCHIVE}
        component={ArchiveScreen}
        options={{
          tabBarLabel: 'History',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>📜</Text>,
        }}
      />
      <Tab.Screen
        name={SCREENS.PROFILE}
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>👤</Text>,
        }}
      />
    </Tab.Navigator>
  );
};

const AppNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name={SCREENS.SPLASH} component={SplashScreen} />
      <Stack.Screen name={SCREENS.LOGIN} component={LoginScreen} />
      <Stack.Screen name={SCREENS.SIGNUP} component={SignupScreen} />
      <Stack.Screen name={SCREENS.CREATE_CASE} component={CreateCaseScreen} />
      <Stack.Screen name={SCREENS.CHAT} component={ChatScreen} />
      <Stack.Screen name={SCREENS.EDIT_PROFILE} component={EditProfileScreen} />
      <Stack.Screen name={SCREENS.CHAT_DETAILS} component={ChatDetailsScreen} />
      <Stack.Screen name={SCREENS.LAWYER_PROFILE} component={LawyerProfileScreen} />
      <Stack.Screen name={SCREENS.LAWYER_LIST} component={LawyerListScreen} />
      <Stack.Screen name={SCREENS.SECURITY_SETTINGS} component={SecuritySettingsScreen} />
      <Stack.Screen name={SCREENS.SUPPORT} component={SupportScreen} />
      <Stack.Screen name={SCREENS.SUBSCRIPTION_PLANS} component={SubscriptionPlansScreen} />
      <Stack.Screen name={SCREENS.MAIN_TABS} component={MainTabs} />
    </Stack.Navigator>
  );
};

export default AppNavigator;
