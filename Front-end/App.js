import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, Image, TouchableOpacity, ScrollView, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Animated } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

const BACKEND_URL = 'https://animal-vet-production.up.railway.app';

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();

  const [isSplashActive, setIsSplashActive] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showCamera, setShowCamera] = useState(false);

  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);

  const [messages, setMessages] = useState([
    { id: '1', sender: 'ai', text: "🐶 Welcome back! Ask me any questions about your pet's behavior, diet, or symptoms, or press the 📷 button below to scan an injury or mood marker." }
  ]);

  const cameraRef = useRef(null);
  const scrollViewRef = useRef(null);

  const splashOpacity = useRef(new Animated.Value(1)).current;
  
  // FIX 1: Initialize at 0, handle displacement offsets inside calculation bounds cleanly
  const menuTranslation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(splashOpacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => setIsSplashActive(false));
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  const toggleMenu = () => {
    if (isMenuOpen) {
      Animated.timing(menuTranslation, {
        toValue: -280, // Slide all the way out of screen space boundary
        duration: 250,
        useNativeDriver: true,
      }).start(() => setIsMenuOpen(false));
    } else {
      setIsMenuOpen(true);
      Animated.timing(menuTranslation, {
        toValue: 0, // Snap directly to normal viewing position
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  };

  if (isSplashActive) {
    return (
      <Animated.View style={[styles.splashContainer, { opacity: splashOpacity }]}>
        <Text style={styles.splashLogo}>🐾</Text>
        <Text style={styles.splashTitle}>Paws & Chat AI</Text>
        <Text style={styles.splashSubtitle}>Veterinary Care Intelligence</Text>
        <ActivityIndicator size="small" color="#FFF" style={{ marginTop: 30 }} />
      </Animated.View>
    );
  }

  if (!permission) {
    return <View style={styles.container}><Text style={styles.loadingText}>Loading permissions...</Text></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ textAlign: 'center', marginBottom: 20, fontSize: 16, color: '#334155', paddingHorizontal: 20 }}>
            Camera access permissions are required to scan physical pet injury symptoms or mood markers.
          </Text>
          <TouchableOpacity style={styles.fallbackBtn} onPress={requestPermission}>
            <Text style={styles.buttonText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const options = { quality: 0.7 };
        const data = await cameraRef.current.takePictureAsync(options);
        setShowCamera(false);

        setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'user', imageUri: data.uri }]);
        await sendChatToBackend(data.uri, "Analyze this image snapshot.");
      } catch (err) {
        alert(`Capture Failure: ${err.message}`);
      }
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    const textToSend = inputText;
    setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'user', text: textToSend }]);
    setInputText('');

    await sendChatToBackend(null, textToSend);
  };

  const sendChatToBackend = async (imageUri, textMessage) => {
    setLoading(true);
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 50);

    try {
      const formData = new FormData();
      formData.append('user_message', textMessage);

      if (imageUri) {
        if (Platform.OS === 'web') {
          const uriResponse = await fetch(imageUri);
          const blob = await uriResponse.blob();
          formData.append('file', blob, 'pet_snapshot.jpg');
        } else {
          const match = /\.(\w+)$/.exec(imageUri);
          const type = match ? `image/${match[1]}` : `image/jpeg`;
          const filename = imageUri.split('/').pop();

          formData.append('file', {
            uri: imageUri,
            name: filename,
            type: type,
          });
        }
      }

      const response = await fetch(`${BACKEND_URL}/analyze-pet`, {
        method: 'POST',
        body: formData,
        headers: { 'Accept': 'application/json' },
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          sender: 'ai',
          text: result.reply_text,
          metrics: result.is_pet_related ? result : null
        }]);
      } else {
        setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'ai', text: `⚠️ Server Error: ${result.detail || "Malformed structure backend response."}` }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'ai', text: `❌ Request Interrupted: ${error.message}` }]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 150);
    }
  };

  return (
    // FIX 2: Swap layout behavior constraint out for safe native adjustments on Android
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>

      <View style={styles.header}>
        <TouchableOpacity style={styles.menuTriggerBtn} onPress={toggleMenu}>
          <Text style={styles.menuIconText}>☰</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🐾 Paws & Chat</Text>
        <View style={{ width: 40 }} />
      </View>

      {!showCamera ? (
        <View style={styles.mainContentLayoutWindow}>
          <ScrollView
            ref={scrollViewRef}
            contentContainerStyle={styles.chatArea}
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          >
            {messages.map((msg) => (
              <View key={msg.id} style={[styles.msgWrapper, msg.sender === 'user' ? styles.userAlign : styles.aiAlign]}>
                {msg.text && (
                  <View style={[styles.bubble, msg.sender === 'user' ? styles.userBubble : styles.aiBubble]}>
                    <Text style={msg.sender === 'user' ? styles.userTxt : styles.aiTxt}>{msg.text}</Text>
                  </View>
                )}
                {msg.imageUri && (
                  <Image source={{ uri: msg.imageUri }} style={styles.chatThumbnailImage} />
                )}
                {msg.metrics && msg.metrics.pet_emotion !== "None" && (
                  <View style={styles.embeddedDashboard}>
                    <View style={styles.dashboardRow}>
                      <View style={styles.metricItem}>
                        <Text style={styles.metricLabel}>Emotion</Text>
                        <Text style={styles.metricVal}>{msg.metrics.pet_emotion}</Text>
                      </View>
                      <View style={styles.metricItem}>
                        <Text style={styles.metricLabel}>Confidence</Text>
                        <Text style={styles.metricVal}>{msg.metrics.confidence_score}%</Text>
                      </View>
                    </View>
                    {msg.metrics.health_observations.length > 0 && (
                      <View style={styles.dashboardSection}>
                        <Text style={styles.metricLabel}>Observations</Text>
                        {msg.metrics.health_observations.map((obs, i) => (
                          <Text key={i} style={styles.bullet}>{`• ${obs}`}</Text>
                        ))}
                      </View>
                    )}
                    {msg.metrics.actionable_advice !== "None" && (
                      <View style={styles.adviceWrapperSection}>
                        <Text style={styles.metricLabel}>Care Plan Advice</Text>
                        <Text style={styles.adviceTxt}>{msg.metrics.actionable_advice}</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            ))}
            {loading && (
              <View style={styles.aiLoadingBlock}>
                <ActivityIndicator size="small" color="#007AFF" />
                <Text style={styles.aiLoadingText}>Gemini is evaluating diagnostics...</Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.inputTrayContainer}>
            <TextInput
              style={styles.textInputBox}
              placeholder="Ask me something about your pet..."
              placeholderTextColor="#94A3B8"
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={handleSendMessage}
            />
            <TouchableOpacity style={styles.sendActionBtn} onPress={handleSendMessage}>
              <Text style={styles.sendIconText}>➡️</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.floatingCameraCenterBtn} onPress={() => setShowCamera(true)}>
              <Text style={styles.floatingCameraIcon}>📷</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <CameraView style={styles.cameraViewportContainer} ref={cameraRef} facing="back">
          <View style={styles.cameraControlFooterRow}>
            <TouchableOpacity style={styles.cancelCameraBtn} onPress={() => setShowCamera(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shutterButtonCircle} onPress={takePicture}>
              <View style={styles.innerShutterDot} />
            </TouchableOpacity>
            <View style={{ width: 60 }} />
          </View>
        </CameraView>
      )}

      {isMenuOpen && (
        <View style={styles.menuDimOverlayBackground}>
          <TouchableOpacity style={styles.dismissOverlayTouchArea} onPress={toggleMenu} />
          {/* FIX 3: Dynamic matrix rendering via native state mapping properties */}
          <Animated.View style={[styles.menuDrawerTray, { transform: [{ translateX: menuTranslation }] }]}>
            <Text style={styles.menuDrawerHeaderTitle}>⚙️ Pet Dashboard</Text>
            <ScrollView style={styles.scrollableMenuOptionsTray} showsVerticalScrollIndicator={false}>
              <TouchableOpacity style={styles.menuItemRow} onPress={() => alert('Profile module configured next setup step!')}>
                <Text style={styles.menuItemText}>🐾 Managed Pet Profiles</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItemRow} onPress={() => alert('Vaccination scheduler live next setup step!')}>
                <Text style={styles.menuItemText}>💉 Vaccination Tracker</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItemRow} onPress={() => alert('Nearby map location routing live next setup step!')}>
                <Text style={styles.menuItemText}>📍 Find Nearby Emergency Vets</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItemRow} onPress={() => alert('Nutrition logs monitoring live next setup step!')}>
                <Text style={styles.menuItemText}>🥩 Feeding & Nutrition Logs</Text>
              </TouchableOpacity>
              <View style={styles.menuItemDividerLine} />
              <TouchableOpacity style={[styles.menuItemRow, { marginTop: 20 }]} onPress={toggleMenu}>
                <Text style={[styles.menuItemText, { color: '#EF4444' }]}>❌ Close Menu</Text>
              </TouchableOpacity>
            </ScrollView>
          </Animated.View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  splashContainer: { ...StyleSheet.absoluteFillObject, backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center', zIndex: 9999 },
  splashLogo: { fontSize: 72, marginBottom: 10 },
  splashTitle: { fontSize: 28, fontWeight: 'bold', color: '#FFF' },
  splashSubtitle: { fontSize: 14, color: '#E0F2FE', marginTop: 4, letterSpacing: 1 },
  header: { backgroundColor: '#FFF', paddingTop: 50, paddingBottom: 15, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderColor: '#E2E8F0', elevation: 3 },
  menuTriggerBtn: { width: 40, height: 40, justifyContent: 'center' },
  menuIconText: { fontSize: 24, color: '#1E293B' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#0F172A' },
  mainContentLayoutWindow: { flex: 1, justifyContent: 'space-between' },
  chatArea: { padding: 16, paddingBottom: 110 },
  msgWrapper: { marginVertical: 8, maxWidth: '85%' },
  userAlign: { alignSelf: 'flex-end' },
  aiAlign: { alignSelf: 'flex-start' },
  bubble: { padding: 12, borderRadius: 16 },
  userBubble: { backgroundColor: '#007AFF', borderBottomRightRadius: 2 },
  aiBubble: { backgroundColor: '#FFF', borderBottomLeftRadius: 2, borderWidth: 1, borderColor: '#E2E8F0' },
  userTxt: { color: '#FFF', fontSize: 15, lineHeight: 20 },
  aiTxt: { color: '#1E293B', fontSize: 15, lineHeight: 20 },
  chatThumbnailImage: { width: 220, height: 150, borderRadius: 12, marginTop: 4, resizeMode: 'cover', borderWidth: 2, borderColor: '#007AFF' },
  aiLoadingBlock: { flexDirection: 'row', alignItems: 'center', marginVertical: 10, alignSelf: 'flex-start' },
  aiLoadingText: { marginLeft: 8, color: '#64748B', fontSize: 13 },
  embeddedDashboard: { backgroundColor: '#FFF', width: 280, borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', padding: 14, marginTop: 8 },
  dashboardRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  metricItem: { flex: 1, backgroundColor: '#F8FAFC', padding: 8, borderRadius: 8, marginHorizontal: 2, borderWidth: 1, borderColor: '#F1F5F9' },
  metricLabel: { fontSize: 10, color: '#94A3B8', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 2 },
  metricVal: { fontSize: 14, fontWeight: 'bold', color: '#0F172A' },
  dashboardSection: { marginVertical: 6 },
  adviceWrapperSection: { borderTopWidth: 1, borderColor: '#F1F5F9', paddingTop: 8, marginTop: 4 },
  bullet: { fontSize: 13, color: '#334155', marginVertical: 2 },
  adviceTxt: { fontSize: 13, color: '#0F172A', lineHeight: 18, fontWeight: '500' },
  inputTrayContainer: { flexDirection: 'row', padding: 12, backgroundColor: '#FFF', borderTopWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', position: 'relative', paddingBottom: Platform.OS === 'ios' ? 25 : 12 },
  textInputBox: { flex: 1, height: 44, backgroundColor: '#F1F5F9', borderRadius: 22, paddingLeft: 16, paddingRight: 60, fontSize: 15, color: '#0F172A' },
  sendActionBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  sendIconText: { fontSize: 16, color: '#FFF' },
  floatingCameraCenterBtn: { position: 'absolute', right: 74, top: -24, width: 56, height: 56, borderRadius: 28, backgroundColor: '#22C55E', justifyContent: 'center', alignItems: 'center', borderWidth: 4, borderColor: '#FFF', elevation: 5 },
  floatingCameraIcon: { fontSize: 24, color: '#FFF' },
  cameraViewportContainer: { flex: 1, justifyContent: 'flex-end' },
  cameraControlFooterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', paddingVertical: 30, paddingHorizontal: 30 },
  shutterButtonCircle: { width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: '#FFF', justifyContent: 'center', alignItems: 'center', alignSelf: 'center' },
  innerShutterDot: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#FFF' },
  cancelCameraBtn: { padding: 10 },
  cancelText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  menuDimOverlayBackground: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 999 },
  dismissOverlayTouchArea: { ...StyleSheet.absoluteFillObject },
  // FIX 4: Explicit placement position rendering rules
  menuDrawerTray: { position: 'absolute', top: 0, bottom: 0, width: 280, backgroundColor: '#FFF', paddingTop: 60, paddingHorizontal: 20 },
  menuDrawerHeaderTitle: { fontSize: 20, fontWeight: 'bold', color: '#0F172A', marginBottom: 25 },
  scrollableMenuOptionsTray: { flex: 1 },
  menuItemRow: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  menuItemText: { fontSize: 15, fontWeight: '500', color: '#334155' },
  menuItemDividerLine: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 15 },
  fallbackBtn: { backgroundColor: '#007AFF', padding: 15, borderRadius: 8, alignSelf: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  loadingText: { textAlign: 'center', color: '#64748B', marginTop: 40 }
});