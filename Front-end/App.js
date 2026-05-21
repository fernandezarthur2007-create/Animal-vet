import React, { useState, useRef } from 'react';
import { StyleSheet, Text, View, Image, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
// Paste your new Railway URL here (e.g., 'https://animal-vet-backend-production.up.railway.app')
const BACKEND_URL = 'http://localhost:8000';

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [photo, setPhoto] = useState(null);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const cameraRef = useRef(null);

  if (!permission) {
    return <View style={styles.container}><Text>Loading permissions...</Text></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={{ textAlign: 'center', marginBottom: 20 }}>We need your permission to show the camera</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const options = { quality: 0.7 };
        const data = await cameraRef.current.takePictureAsync(options);
        setPhoto(data.uri);
        sendImageToBackend(data.uri);
      } catch (err) {
        setAnalysis(`Camera Capture Error: ${err.message}`);
      }
    }
  };

  const sendImageToBackend = async (imageUri) => {
    setLoading(true);
    setAnalysis(null);

    try {
      // For React Native Web, we must fetch the data URI to convert it into a true Blob
      const uriResponse = await fetch(imageUri);
      const blob = await uriResponse.blob();

      const formData = new FormData();
      formData.append('file', blob, 'pet_image.jpg');

      const response = await fetch(`${BACKEND_URL}/analyze-pet`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      console.log("🔥 SERVER PAYLOAD RECEIVED:", result); // Debugging checkpoint
      
      if (response.ok) {
        // Since we now receive a beautiful JSON object, we save it directly to state!
        let safeData = result.analysis || result.message || result.error;
        setAnalysis(safeData);
      } else {
        console.error("❌ SERVER ERROR:", result); // Debugging checkpoint
        // Fix for [object Object] rendering
        const errorDetail = typeof result.detail === 'string' 
          ? result.detail 
          : JSON.stringify(result.detail, null, 2);
        setAnalysis(`Server Error: \n${errorDetail}`);
      }
    } catch (error) {
      setAnalysis(`Network Connection Error.\n\nMake sure your phone and laptop are on the EXACT same Wi-Fi network name.\n\nDetails: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const resetCamera = () => {
    setPhoto(null);
    setAnalysis(null);
  };

  return (
    <View style={styles.container}>
      {!photo ? (
        <CameraView style={styles.camera} ref={cameraRef} facing="back">
          <View style={styles.cameraButtonContainer}>
            <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
              <View style={styles.innerCaptureButton} />
            </TouchableOpacity>
          </View>
        </CameraView>
      ) : (
        <View style={styles.previewContainer}>
          <Image source={{ uri: photo }} style={styles.previewImage} />

          <ScrollView style={styles.analysisContainer}>
            {loading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>Sending photo to Vet AI engine...</Text>
              </View>
            )}
            {analysis && typeof analysis === 'object' && !analysis.error ? (
              <View style={styles.dashboardContainer}>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Emotion & Confidence</Text>
                  <View style={styles.row}>
                    <View style={[styles.badge, { backgroundColor: '#e0f2fe' }]}>
                      <Text style={styles.badgeText}>{analysis.pet_emotion || 'Unknown'}</Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: '#dcfce7' }]}>
                      <Text style={styles.badgeText}>{analysis.confidence_score || 0}% Confident</Text>
                    </View>
                  </View>
                </View>
                
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Health Observations</Text>
                  {(analysis.health_observations || []).map((obs, i) => (
                    <Text key={i} style={styles.listItem}>• {obs}</Text>
                  ))}
                </View>

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Actionable Advice</Text>
                  <Text style={styles.cardText}>{analysis.actionable_advice}</Text>
                </View>
              </View>
            ) : analysis ? (
              <View style={styles.resultBox}>
                <Text style={styles.analysisText}>{typeof analysis === 'string' ? analysis : JSON.stringify(analysis)}</Text>
              </View>
            ) : null}
          </ScrollView>

          {!loading && (
            <TouchableOpacity style={styles.resetButton} onPress={resetCamera}>
              <Text style={styles.buttonText}>Take Another Picture</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', justifyContent: 'center' },
  camera: { flex: 1, justifyContent: 'flex-end' },
  cameraButtonContainer: { backgroundColor: 'transparent', alignSelf: 'center', marginBottom: 40 },
  captureButton: { width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  innerCaptureButton: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff' },
  previewContainer: { flex: 1, backgroundColor: '#f5f5f5', paddingTop: 40 },
  previewImage: { width: '100%', height: 260, resizeMode: 'cover' },
  analysisContainer: { flex: 1, padding: 20 },
  resultBox: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  analysisText: { 
    fontSize: 16, 
    lineHeight: 26, 
    color: '#111827', // Very dark gray/black for high contrast 
    fontWeight: '500' 
  },
  loadingContainer: { alignItems: 'center', marginTop: 40 },
  loadingText: { marginTop: 10, fontSize: 16, color: '#666', fontWeight: '500' },
  button: { backgroundColor: '#007AFF', padding: 15, borderRadius: 8, alignSelf: 'center' },
  resetButton: { backgroundColor: '#007AFF', padding: 15, margin: 20, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  dashboardContainer: { width: '100%', paddingBottom: 20 },
  card: { backgroundColor: '#fff', padding: 15, borderRadius: 10, marginBottom: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2, borderWidth: 1, borderColor: '#eee' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#374151', marginBottom: 10 },
  cardText: { fontSize: 15, color: '#4b5563', lineHeight: 22 },
  row: { flexDirection: 'row', gap: 10 },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  badgeText: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  listItem: { fontSize: 15, color: '#4b5563', lineHeight: 24, marginBottom: 4 },
});