import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import axiosClient from './axiosClient';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function registerForPushNotificationsAsync() {
  if (Platform.OS === 'web') {
    return null;
  }
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.warn('Failed to get push token for push notification!');
      return;
    }
    
    // NOTE: For a real app, you need a projectId from Expo Dashboard
    // token = (await Notifications.getExpoPushTokenAsync({ projectId: 'YOUR_PROJECT_ID' })).data;
    
    // For now, we use a placeholder or generic FCM token if available
    token = (await Notifications.getDevicePushTokenAsync()).data;
    console.log('Push Token:', token);
  } else {
    console.warn('Must use physical device for Push Notifications');
  }

  return token;
}

export const syncPushToken = async () => {
  try {
    const token = await registerForPushNotificationsAsync();
    if (token) {
      await axiosClient.patch('/profile/settings', { fcmToken: token });
      console.log('Push token synced to backend');
    }
  } catch (error) {
    console.error('Error syncing push token:', error);
  }
};
