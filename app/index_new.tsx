import React, { useEffect } from "react";
import {
  StyleSheet,
  View,
  SafeAreaView,
  ActivityIndicator,
} from "react-native";
import {
  useTheme,
  Text,
  Appbar,
} from "react-native-paper";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useThemeContext } from "@/context/ThemeContext";
import { WebView } from 'react-native-webview';

type themeModeType = "light" | "dark";

// Keep splash screen visible while fonts load
SplashScreen.preventAutoHideAsync();

export default function Index() {
  const { toggleTheme, setTheme } = useThemeContext();
  const theme = useTheme();
  
  // --- Font Loading ---
  const [loaded, error] = useFonts({
    "Roboto-Regular": require("@/assets/fonts/roboto.ttf"),
    "Roboto-Bold": require("@/assets/fonts/boldonse.ttf"),
    "my-font": require("@/assets/fonts/myfont.ttf"),
    "bung-ee": require("@/assets/fonts/bungee.ttf"),
  });

  useEffect(() => {
    const themesetter = async () => {
      const storedTheme = await AsyncStorage.getItem("theme");
      if (storedTheme) setTheme(storedTheme as themeModeType);
    };
    themesetter();
  }, []);

  // --- Hide Splash Screen When Ready ---
  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  // --- Loading State ---
  if (!loaded && !error) {
    return null;
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      {/* Custom Header */}
      <Appbar.Header
        mode="center-aligned"
        elevated={false}
        style={{ backgroundColor: theme.colors.background }}
      >
        <Appbar.Action icon="theme-light-dark" onPress={() => toggleTheme()} />
        <Appbar.Content title="Tartoro" />
      </Appbar.Header>

      {/* Website View */}
      <View style={{ flex: 1, marginTop: 10 }}>
        <WebView
          source={{ uri: 'https://tartoro.com' }}
          style={{ flex: 1 }}
          startInLoadingState={true}
          renderLoading={() => (
            <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={{ color: theme.colors.onBackground, marginTop: 10, fontSize: 16 }}>
                Loading tartoro.com...
              </Text>
            </View>
          )}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.warn('WebView error: ', nativeEvent);
          }}
          onHttpError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.warn('WebView HTTP error: ', nativeEvent);
          }}
        />
      </View>
    </SafeAreaView>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
});
