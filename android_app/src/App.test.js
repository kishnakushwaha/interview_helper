import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';

const App = () => {
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.title}>DesierAI Test Build</Text>
                <Text style={styles.text}>If you see this, the core app is working!</Text>
                <Text style={styles.subtext}>The problem is likely with the voice recording modules.</Text>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    title: { fontSize: 24, fontWeight: 'bold', color: '#f8fafc', marginBottom: 10 },
    text: { fontSize: 18, color: '#f1f5f9', textAlign: 'center' },
    subtext: { fontSize: 14, color: '#94a3b8', marginTop: 20 },
});

export default App;
