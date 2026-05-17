import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import colors from '../theme/colors';

const LanguageModal = ({ visible, onSelect }) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Select Language / زبان منتخب کریں</Text>
          <Text style={styles.subtitle}>Choose your preferred language</Text>

          <TouchableOpacity style={styles.btnEnglish} onPress={() => onSelect('en')}>
            <Text style={styles.icon}>🇬🇧</Text>
            <View style={styles.textCol}>
              <Text style={styles.titleEnglish}>English</Text>
              <Text style={styles.subtitleEnglish}>Continue in English</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.btnUrdu} onPress={() => onSelect('ur')}>
            <Text style={styles.icon}>🇵🇰</Text>
            <View style={styles.textCol}>
              <Text style={styles.titleUrdu}>اردو</Text>
              <Text style={styles.subtitleUrdu}>اردو میں جاری رکھیں</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#00000090',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 32,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  subtitle: {
    color: '#888888',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 32,
  },
  btnEnglish: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  btnUrdu: {
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  icon: {
    fontSize: 24,
    marginRight: 16,
  },
  textCol: {
    flex: 1,
  },
  titleEnglish: {
    color: '#000000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  subtitleEnglish: {
    color: '#333333',
    fontSize: 12,
  },
  titleUrdu: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  subtitleUrdu: {
    color: '#888888',
    fontSize: 12,
  },
});

export default LanguageModal;
