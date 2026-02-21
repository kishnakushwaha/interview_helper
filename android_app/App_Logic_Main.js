import React, { useState, useEffect, useRef } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    ScrollView,
    SafeAreaView,
    StatusBar,
    PermissionsAndroid,
    Platform,
} from 'react-native';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import axios from 'axios';
import RNFS from 'react-native-fs';

const BACKEND_URL = 'http://192.168.1.XX:8000/audio/listen-and-answer'; // Replace XX with your IP or ngrok URL
const USER_TOKEN = 'mock-test-token'; // Token for test

const App = () => {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [answer, setAnswer] = useState('');
    const [keyPoints, setKeyPoints] = useState([]);
    const [history, setHistory] = useState([]);

    const audioRecorderPlayer = useRef(new AudioRecorderPlayer()).current;
    const timerRef = useRef(null);

    useEffect(() => {
        return () => {
            stopListening();
        };
    }, []);

    const requestPermissions = async () => {
        if (Platform.OS === 'android') {
            try {
                const grants = await PermissionsAndroid.requestMultiple([
                    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
                ]);

                if (grants['android.permission.RECORD_AUDIO'] === PermissionsAndroid.RESULTS.GRANTED) {
                    console.log('Permissions granted');
                    return true;
                } else {
                    console.log('Permissions denied');
                    return false;
                }
            } catch (err) {
                console.warn(err);
                return false;
            }
        }
        return true;
    };

    const startListening = async () => {
        const hasPermission = await requestPermissions();
        if (!hasPermission) return;

        setIsListening(true);
        setTranscript('Listening...');

        // Start cyclic recording
        runRecordingCycle();
    };

    const runRecordingCycle = async () => {
        const path = Platform.select({
            android: `${RNFS.CachesDirectoryPath}/interview_chunk.mp4`,
            ios: 'interview_chunk.m4a',
        });

        await audioRecorderPlayer.startRecorder(path);

        // Record for 8 seconds then process
        timerRef.current = setTimeout(async () => {
            const result = await audioRecorderPlayer.stopRecorder();
            processAudioChunk(result);

            // Continue the cycle if still listening
            if (isListening) {
                runRecordingCycle();
            }
        }, 8000);
    };

    const processAudioChunk = async (uri) => {
        const formData = new FormData();
        formData.append('file', {
            uri: Platform.OS === 'android' ? `file://${uri}` : uri,
            type: 'audio/mp4',
            name: 'chunk.mp4',
        });
        formData.append('history', JSON.stringify(history));

        try {
            const response = await axios.post(BACKEND_URL, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    'Authorization': `Bearer ${USER_TOKEN}`,
                },
            });

            const { transcript: newTranscript, answer: newAnswer, key_points } = response.data;

            if (newTranscript && newTranscript.trim()) {
                setTranscript(newTranscript);
                setAnswer(newAnswer);
                setKeyPoints(key_points || []);

                // Update history for next context
                const newHistory = [...history, { question: newTranscript, answer: newAnswer }].slice(-10);
                setHistory(newHistory);
            }
        } catch (error) {
            console.error('API Error:', error);
        }
    };

    const stopListening = async () => {
        setIsListening(false);
        clearTimeout(timerRef.current);
        await audioRecorderPlayer.stopRecorder();
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" />
            <View style={styles.header}>
                <Text style={styles.title}>DesierAI Interview</Text>
                <Text style={styles.status}>{isListening ? '🔵 Listening...' : '⚪️ Idle'}</Text>
            </View>

            <ScrollView style={styles.content}>
                <View style={styles.card}>
                    <Text style={styles.label}>LAST HEARD</Text>
                    <Text style={styles.transcriptText}>{transcript || 'Say something...'}</Text>
                </View>

                {answer ? (
                    <View style={styles.cardHighlight}>
                        <Text style={styles.labelHighlight}>AI ANSWER</Text>
                        <Text style={styles.answerText}>{answer}</Text>

                        {keyPoints.length > 0 && (
                            <View style={styles.pointsContainer}>
                                {keyPoints.map((point, i) => (
                                    <Text key={i} style={styles.point}>• {point}</Text>
                                ))}
                            </View>
                        )}
                    </View>
                ) : null}
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.button, isListening ? styles.buttonStop : styles.buttonStart]}
                    onPress={isListening ? stopListening : startListening}>
                    <Text style={styles.buttonText}>
                        {isListening ? 'STOP INTERVIEW' : 'START LISTENING'}
                    </Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    header: { padding: 20, borderBottomWidth: 1, borderBottomColor: '#1e293b', alignItems: 'center' },
    title: { fontSize: 20, fontWeight: 'bold', color: '#f8fafc' },
    status: { fontSize: 14, color: '#94a3b8', marginTop: 4 },
    content: { flex: 1, padding: 15 },
    card: { backgroundColor: '#1e293b', padding: 15, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderBottomColor: '#334155' },
    cardHighlight: { backgroundColor: '#334155', padding: 20, borderRadius: 12, borderWidth: 1, borderColor: '#38bdf8' },
    label: { fontSize: 12, fontWeight: 'bold', color: '#64748b', marginBottom: 8 },
    labelHighlight: { fontSize: 12, fontWeight: 'bold', color: '#38bdf8', marginBottom: 8 },
    transcriptText: { fontSize: 16, color: '#f1f5f9', fontStyle: 'italic' },
    answerText: { fontSize: 18, color: '#f8fafc', lineHeight: 26 },
    pointsContainer: { marginTop: 15, borderTopWidth: 1, borderTopColor: '#475569', paddingTop: 10 },
    point: { color: '#cbd5e1', fontSize: 14, marginBottom: 4 },
    footer: { padding: 20, backgroundColor: '#0f172a' },
    button: { padding: 16, borderRadius: 12, alignItems: 'center' },
    buttonStart: { backgroundColor: '#2563eb' },
    buttonStop: { backgroundColor: '#dc2626' },
    buttonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
});

export default App;
