import React from 'react';
import 'react-native-gesture-handler';
import './src/i18n/index';
import { Provider } from 'react-redux'
import { Provider as PaperProvider, MD3DarkTheme } from 'react-native-paper'
import { NavigationContainer } from '@react-navigation/native'
import { store } from './src/store/index'
import AppNavigator from './src/navigation/AppNavigator'
import { useFonts, NotoNastaliqUrdu_400Regular } from '@expo-google-fonts/noto-nastaliq-urdu';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();

const theme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#C9A84C',
    background: '#0D0D0D',
    surface: '#1A1A1A',
  }
}

export default function App() {
  const [fontsLoaded] = useFonts({
    NotoNastaliqUrdu: NotoNastaliqUrdu_400Regular,
  });

  const onLayoutRootView = React.useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <Provider store={store}>
      <PaperProvider theme={theme}>
        <NavigationContainer onReady={onLayoutRootView}>
          <AppNavigator />
        </NavigationContainer>
      </PaperProvider>
    </Provider>
  )
}
