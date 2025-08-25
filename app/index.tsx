import React, { useEffect, useState } from "react";
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
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useThemeContext } from "@/context/ThemeContext";
import { WebView } from 'react-native-webview';

const BUTTON_WIDTH = 150;
const BUTTON_GAP = 0;
const LEFT_POSITION = 40;
const RIGHT_POSITION = BUTTON_WIDTH + 60;

// Keep splash screen visible while fonts load or data loads
SplashScreen.preventAutoHideAsync();

// --- Counter Interface ---
export interface Counter {
  id: string;
  name: string;
  createdAt: number; // Timestamp (milliseconds since epoch) when created
  isArchived: boolean; // For Current/Past tabs
  hasNotification?: boolean; // Optional: for the bell icon
  type: "countdown" | "countup";
  completed: boolean;
  notificationId: string | undefined;
  todayNotificationId?: string;
}

// --- AsyncStorage Key ---
const STORAGE_KEY = "@days_since_app_data_v2"; // Use versioned key

type themeModeType = "light" | "dark" | "system";

export default function Index() {
  const { themeMode } = useThemeContext();
  const { toggleTheme, setTheme } = useThemeContext();
  const theme = useTheme(); // Access theme colors
  const sliderTranslateX = useSharedValue(LEFT_POSITION);

  const { counters, setCounters, markCounterCompleted } = useCounterContext();

  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [currentView, setCurrentView] = useState<"current" | "archive">(
    "current"
  );
  const [viewMode, setViewMode] = useState<"counters" | "website">("website"); // New state for switching between counters and website
  const [tick, setTick] = useState(0); // State to force updates for elapsed time

  const router = useRouter(); // Initialize router

  // setting initial position of slider
  useEffect(() => {
    if (currentView === "current") {
      sliderTranslateX.value = withTiming(LEFT_POSITION, {
        duration: 180,
        easing: Easing.linear,
      });
    } else {
      sliderTranslateX.value = withTiming(RIGHT_POSITION, {
        duration: 180,
        easing: Easing.linear,
      });
    }
  }, [currentView]);

  useEffect(() => {
    const themesetter = async () => {
      const storedTheme = await AsyncStorage.getItem("theme");
      if (storedTheme) setTheme(storedTheme as themeModeType);
    };
    themesetter();
    // setDate(undefined); // Removed: Date state is now in add.modal.tsx
  }, []);

  // --- Font Loading ---
  const [loaded, error] = useFonts({
    "Roboto-Regular": require("@/assets/fonts/roboto.ttf"),
    "Roboto-Bold": require("@/assets/fonts/boldonse.ttf"), // Ensure this path is correct
    "my-font": require("@/assets/fonts/myfont.ttf"),
    "bung-ee": require("@/assets/fonts/bungee.ttf"),
  });

  // --- Load Counters from Storage ---
  useEffect(() => {
    const loadCounters = async () => {
      try {
        const storedCounters = await AsyncStorage.getItem(STORAGE_KEY);
        if (storedCounters !== null) {
          const parsedCounters: Partial<Counter>[] = JSON.parse(storedCounters);
          const correctedCounters: Counter[] = parsedCounters.map(
            (c, index) => ({
              id: c.id || `${Date.now()}-${index}`,
              name: c.name || "Unnamed Counter",
              createdAt: c.createdAt || Date.now(),
              isArchived: c.isArchived === true,
              hasNotification: c.hasNotification === true,
              type: c.type || "countup",
              completed: c.completed || false,
            })
          );
          setCounters(correctedCounters);
        }
      } catch (e) {
        console.error("Failed to load counters.", e);
        Alert.alert("Error", "Could not load saved counters.");
      } finally {
        setIsDataLoaded(true);
      }
    };
    loadCounters();
  }, []); // Empty dependency array means this runs once on mount

  // --- Hide Splash Screen ---
  useEffect(() => {
    if ((loaded || error) && isDataLoaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error, isDataLoaded]);

  // --- Save Counters to Storage ---
  useEffect(() => {
    if (!isDataLoaded) {
      return;
    }
    const saveCounters = async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(counters));
      } catch (e) {
        console.error("Failed to save counters.", e);
      }
    };
    saveCounters();
  }, [counters, isDataLoaded]);

  // --- Global Timer for Live Elapsed Time Updates ---
  useEffect(() => {
    const activeTimeCounters = counters.filter(
      (c) => !c.isArchived && Date.now() - c.createdAt < 24 * 60 * 60 * 1000
    );
    if (activeTimeCounters.length === 0) {
      return;
    }

    const intervalId = setInterval(() => {
      setTick((prev) => prev + 1);
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [counters, currentView]);

  // helper function for setting state of view
  const handleFlingDirection = (direction: "left" | "right") => {
    if (direction === "right") {
      setCurrentView("current");

      sliderTranslateX.value = withTiming(LEFT_POSITION, {
        duration: 200,
        easing: Easing.linear,
      });
    } else if (direction === "left") {
      setCurrentView("archive");
      sliderTranslateX.value = withTiming(RIGHT_POSITION, {
        duration: 200,
        easing: Easing.linear,
      });
    }
  };

  // listners of gesture
  const flingRightGesture = Gesture.Fling()
    .direction(Directions.RIGHT)
    .onStart(() => {
      runOnJS(handleFlingDirection)("right");
    });

  const flingLeftGesture = Gesture.Fling()
    .direction(Directions.LEFT)
    .onStart(() => {
      runOnJS(handleFlingDirection)("left");
    });

  // slider animation
  const animatedSliderStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: sliderTranslateX.value }],
    };
  });

  // --- Filtered Counters for Display ---
  const displayedCounters = useMemo(() => {
    return counters.filter((c) =>
      currentView === "current" ? !c.isArchived : c.isArchived
    );
  }, [counters, currentView]);

  const handleDeleteCounter = (id: string) => {
    const counterToDelete = counters.find((c) => c.id === id);
    Alert.alert(
      "Delete Counter",
      `Are you sure you want to delete "${
        counterToDelete?.name || "this counter"
      }"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            setCounters((prevCounters) =>
              prevCounters.filter((counter) => counter.id !== id)
            );
          },
        },
      ]
    );
  };

  const handleArchiveToggle = (id: string) => {
    const targetCounter = counters.find((c) => c.id === id);
    if (!targetCounter || targetCounter.completed === true) return;

    const nextIsArchived = !targetCounter.isArchived;
    setCounters((prevCounters) =>
      prevCounters.map((counter) =>
        counter.id === id ? { ...counter, isArchived: nextIsArchived } : counter
      )
    );
    ToastAndroid.show(
      `"${targetCounter.name}" moved to ${
        nextIsArchived ? "Past" : "Current"
      }.`,
      1000
    );
  };

  const handleComplete = (id: string) => {
    const targetCounter = counters.find((c) => c.id === id);
    if (!targetCounter) return;

    markCounterCompleted(id);
    ToastAndroid.show(`"${targetCounter.name}" moved to ${"Past"}.`, 1000);
  };

  const calculateCountup = (elapsedMs: number, baseStyle: StyleProp<any>) => {
    const totalSeconds = Math.floor(elapsedMs / 1000);
    const totalMinutes = Math.floor(totalSeconds / 60);
    const totalHours = Math.floor(totalMinutes / 60);
    const totalDays = Math.floor(totalHours / 24);

    let displayValue: string | number;
    let displayLabel: string;
    let isDaysView = false;

    if (totalDays > 0) {
      displayValue = totalDays;
      displayLabel = totalDays === 1 ? "DAY SINCE" : "DAYS SINCE";
      isDaysView = true;
      baseStyle = styles.daysNumber;
    } else if (totalHours >= 1) {
      displayValue = totalHours;
      displayLabel = "HOURS SINCE";
    } else if (totalMinutes >= 1) {
      displayValue = totalMinutes;
      displayLabel = "MINUTES SINCE";
    } else {
      displayValue = totalSeconds;
      displayLabel = "SECONDS SINCE";
    }

    return {
      displayLabel,
      displayValue,
      isDaysView,
      remainingSeconds: 1, // Placeholder for countup
    };
  };

  const calculateCountdown = (
    forthcommingMs: number,
    baseStyle: StyleProp<any>
  ) => {
    const remainingSeconds = Math.floor(forthcommingMs / 1000);
    const remainingMinutes = Math.floor(remainingSeconds / 60);
    const remainingHours = Math.floor(remainingMinutes / 60);
    const remainingDays = Math.floor(remainingHours / 24);

    let displayValue: string | number;
    let displayLabel: string;
    let isDaysView = false;

    if (remainingDays > 0) {
      displayValue = remainingDays;
      displayLabel = remainingDays === 1 ? "DAY TO" : "DAYS TO";
      isDaysView = true;
      baseStyle = styles.daysNumber;
    } else if (remainingHours >= 1) {
      displayValue = remainingHours;
      displayLabel = "HOURS TO";
    } else if (remainingMinutes >= 1) {
      displayValue = remainingMinutes;
      displayLabel = "MINUTES TO";
    } else {
      displayValue = remainingSeconds;
      displayLabel = "SECONDS TO";
    }

    return {
      displayLabel,
      displayValue,
      isDaysView,
      remainingSeconds,
    };
  };

  // --- Render Item for FlatList ---
  const renderCounterItem = useCallback(
    ({ item }: { item: Counter }) => {
      const now = Date.now();
      const elapsedMs = Math.max(0, now - item.createdAt);
      const forthcommingMs = Math.max(0, item.createdAt - now);

      let baseStyle = styles.hoursMinutesSecondsNumber; // Default to H/M/S style

      const { displayLabel, displayValue, isDaysView, remainingSeconds } =
        item.type === "countdown"
          ? calculateCountdown(forthcommingMs, baseStyle)
          : calculateCountup(elapsedMs, baseStyle);

      const formattedDate = format(new Date(item.createdAt), "MMM dd, yyyy");

      if (
        item.type === "countdown" &&
        remainingSeconds <= 0 &&
        !item.completed
      ) {
        setTimeout(() => {
          handleComplete(item.id);
        }, 0);
      }

      return (
        <TouchableOpacity
          onPress={() => {
            // No need for setSelectedCounter if passing params directly
            router.push({
              pathname: "/details",
              params: {
                creation: item.createdAt,
                name: item.name,
                id: item.id.toString(),
                type: item.type.toString(),
                completed: item.completed.toString(),
              },
            });
          }}
          onLongPress={() => handleArchiveToggle(item.id)}
          delayLongPress={1000}
        >
          <View style={styles.cardContainer}>
            <LinearGradient
              colors={
                item.type === "countdown"
                  ? ["#E0E0E0", "#4285F4"]
                  : ["#FEC9CE", "#FF96A1"]
              }
              start={{ x: 1, y: 1 }}
              end={{ x: 0, y: 0 }}
              style={styles.gradient}
            >
              {!item.completed ? (
                <View style={styles.cardContent}>
                  {/* Left Side */}
                  <View style={styles.leftColumn}>
                    <Text
                      style={[baseStyle]}
                      key={
                        !isDaysView && !item.isArchived
                          ? `time-${tick}`
                          : `static-${item.id}`
                      }
                    >
                      {displayValue}
                    </Text>
                    <Text style={styles.daysLabel}>{displayLabel}</Text>
                  </View>

                  {/* Right Side */}
                  <View style={styles.rightColumn}>
                    <Text style={styles.dateText}>{formattedDate}</Text>
                    <Text
                      style={styles.nameText}
                      numberOfLines={2}
                      ellipsizeMode="tail"
                    >
                      {item.name}
                    </Text>
                  </View>

                  {/* Optional: Notification Bell Icon */}
                  {item.hasNotification && (
                    <IconButton
                      icon="bell-outline"
                      size={18}
                      style={styles.notificationIcon}
                      iconColor={"rgba(0, 0, 0, 0.6)"}
                    />
                  )}

                  {/* Trash Icon */}
                  <IconButton
                    icon="delete-outline"
                    size={20}
                    onPress={() => handleDeleteCounter(item.id)}
                    iconColor={theme.colors.onPrimary}
                    style={styles.deleteIcon}
                  />
                </View>
              ) : (
                <View
                  style={[
                    styles.cardContent,
                    {
                      flexDirection: "column",
                      alignItems: "flex-start",
                      justifyContent: "center",
                      maxHeight: 120,
                      paddingVertical: 0,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.hoursMinutesSecondsNumber,
                      {
                        fontSize: 40,
                        lineHeight: 50,
                        textDecorationLine: "line-through",
                      },
                    ]}
                  >
                    {item.name.substring(0, 10)}
                  </Text>
                  <IconButton
                    icon="delete-outline"
                    size={20}
                    onPress={() => handleDeleteCounter(item.id)}
                    iconColor={theme.colors.onPrimary}
                    style={styles.deleteIcon}
                  />
                  <Text
                    style={[styles.hoursMinutesSecondsNumber, { fontSize: 30 }]}
                  >
                    completed
                  </Text>
                </View>
              )}
            </LinearGradient>
          </View>
        </TouchableOpacity>
      );
    },
    [
      theme.colors.error,
      tick,
      router,
      handleDeleteCounter,
      handleArchiveToggle,
      handleComplete,
    ]
  ); // Added router, handleDeleteCounter, etc. to dependencies

  // --- Main Render ---
  if (!loaded || !isDataLoaded) {
    return null;
  }
  if (error) {
    console.error("Font loading error:", error);
    return (
      <SafeAreaView
        style={[
          styles.container,
          { backgroundColor: theme?.colors?.background || "#fff" },
        ]}
      >
        <View style={styles.centeredError}>
          <Text
            style={{ color: theme?.colors?.error || "red", marginBottom: 10 }}
          >
            Error loading application assets.
          </Text>
          <Text style={{ color: theme?.colors?.onSurface || "#000" }}>
            Please restart the app. Font: {error.message}
          </Text>
        </View>
      </SafeAreaView>
    );
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
        <Appbar.Action 
          icon={viewMode === "website" ? "counter" : "web"} 
          onPress={() => setViewMode(viewMode === "website" ? "counters" : "website")} 
        />
        <Appbar.Content title={viewMode === "website" ? "Website" : "TimeKeeper"} />
        {viewMode === "counters" && (
          <Appbar.Action
            icon="plus"
            size={28}
            onPress={() => {
              // Removed direct modal state management
              router.push("/add.modal"); // Navigate to the add.modal screen
            }}
          />
        )}
      </Appbar.Header>

      {viewMode === "website" ? (
        // Website View
        <View style={{ flex: 1, marginTop: 10 }}>
          <WebView
            source={{ uri: 'https://tartoro.com' }}
            style={{ flex: 1 }}
            startInLoadingState={true}
            renderLoading={() => (
              <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={{ color: theme.colors.onBackground, marginTop: 10 }}>
                  Loading tartoro.com...
                </Text>
              </View>
            )}
          />
        </View>
      ) : (
        // Counters View
        <>
          <View style={styles.segmentContainer}>
            <Animated.View
              style={[
                styles.sliderBackground,
                animatedSliderStyle,
                {
                  backgroundColor: "#4285F4",
                },
              ]}
            />
            <Button
              labelStyle={[
                styles.buttonLabel,
                {
                  fontSize: currentView === "current" ? 17 : 15,
                  fontWeight: currentView === "current" ? "bold" : "900",
                },
              ]}
              onPress={() => setCurrentView("current")}
              style={[styles.topbtn, styles.transparentButton, {}]}
              textColor={themeMode === "dark" ? "#fff" : "#000"}
            >
              Counters
            </Button>

            <Button
              labelStyle={[
                styles.buttonLabel,
                {
                  fontSize: currentView === "archive" ? 17 : 15,
                  fontWeight: currentView === "archive" ? "bold" : "900",
                },
              ]}
              onPress={() => setCurrentView("archive")}
              style={[styles.topbtn, styles.transparentButton]}
              textColor={themeMode === "dark" ? "#fff" : "#000"}
            >
              Archives
            </Button>
          </View>
          <GestureDetector
            gesture={Gesture.Simultaneous(flingRightGesture, flingLeftGesture)}
          >
            <View style={{ flex: 1 }}>
              <FlatList
                data={displayedCounters}
                renderItem={renderCounterItem} // No conditional rendering based on isModalVisible
                keyExtractor={(item) => item.id}
                ListEmptyComponent={
                  <View style={styles.centered}>
                    <Text style={styles.emptyText}>
                      No counters {currentView === "archive" ? "archived" : "yet"}.
                    </Text>
                    {currentView === "current" && !isDataLoaded && (
                      <ActivityIndicator style={{ marginTop: 20 }} size="large" />
                    )}
                    {currentView === "current" &&
                      isDataLoaded &&
                      displayedCounters.length === 0 && (
                        <Text style={styles.emptyText}>Press '+' to add one!</Text>
                      )}
                  </View>
                }
                contentContainerStyle={styles.listContent}
              />
            </View>
          </GestureDetector>
        </>
      )}
    </SafeAreaView>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 50,
  },
  centeredError: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  buttonLabel: {
    // color: "#000",
    fontSize: 15,
  },
  topbtn: {
    width: BUTTON_WIDTH,
    padding: 5,
    borderRadius: 30,
    zIndex: 1,
  },
  transparentButton: {
    backgroundColor: "transparent",
  },
  segmentContainer: {
    flexDirection: "row",
    width: "100%",
    justifyContent: "space-evenly",
    alignItems: "center",
    marginBottom: 20,
    gap: BUTTON_GAP,
    position: "relative",
    borderRadius: 10,
    padding: 5,
  },
  segmentButtons: {
    borderRadius: 10,
  },
  segmentSelected: {
    backgroundColor: "#FEC9CE",
  },
  segmentUnselected: {
    backgroundColor: "transparent",
  },
  segmentSelectedLabel: {
    fontFamily: "Roboto-Regular",
    fontSize: 16,
    color: "#333",
    fontWeight: "600",
  },
  segmentUnselectedLabel: {
    fontFamily: "Roboto-Regular",
    fontSize: 14,
    color: "#555",
  },
  listContent: {
    paddingHorizontal: 15,
    paddingBottom: 30,
    paddingTop: 10,
    flexGrow: 1,
  },
  cardContainer: {
    marginVertical: 7,
    borderRadius: 18,
  },
  gradient: {
    borderRadius: 18,
    overflow: "hidden",
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    paddingHorizontal: 10,
    position: "relative",
  },
  leftColumn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    maxWidth: 145,
  },
  sliderBackground: {
    position: "absolute",
    height: 2,
    width: BUTTON_WIDTH - 50,
    backgroundColor: "#FF96A3",
    borderRadius: 15,
    left: 5,
    top: 45,
    elevation: 1,
  },
  rightColumn: {
    flex: 1,
    justifyContent: "center",
    alignItems: "baseline",
    marginBottom: 30,
  },
  daysNumber: {
    fontSize: 55,
    fontFamily: "bung-ee",
    color: "#000",
    lineHeight: 70,
    textAlign: "center",
  },
  hoursMinutesSecondsNumber: {
    fontSize: 55,
    fontFamily: "bung-ee",
    color: "#111",
    lineHeight: 70,
    textAlign: "center",
  },
  daysLabel: {
    fontSize: 10,
    fontFamily: "my-font",
    color: "#333",
    letterSpacing: 1.2,
    fontWeight: "900",
    marginTop: 4,
    textTransform: "uppercase",
    textAlign: "center",
  },
  dateText: {
    fontSize: 15,
    fontFamily: "Roboto-Regular",
    color: "#555",
    marginBottom: 4,
    fontWeight: "bold",
  },
  nameText: {
    fontSize: 20,
    fontFamily: "Roboto-Regular",
    fontWeight: "bold",
    color: "#000",
    lineHeight: 20,
  },
  notificationIcon: {
    position: "absolute",
    top: 5,
    right: 35,
    zIndex: 1,
  },
  deleteIcon: {
    position: "absolute",
    top: 5,
    right: 5,
    zIndex: 1,
  },
  emptyText: {
    textAlign: "center",
    fontSize: 30,
    fontFamily: "my-font",
    color: "#777",
    marginTop: 15,
    lineHeight: 35,
    fontWeight: "condensedBold",
  },
});
