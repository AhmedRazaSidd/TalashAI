import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import colors from '../theme/colors';

const GenderToggle = ({ selected, onSelect, maleText = 'Male', femaleText = 'Female' }) => {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.button, selected === 'Male' ? styles.selected : styles.unselected]}
        onPress={() => onSelect('Male')}
      >
        <Text style={[styles.text, selected === 'Male' ? styles.textSelected : styles.textUnselected]}>
          {maleText}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.button, selected === 'Female' ? styles.selected : styles.unselected]}
        onPress={() => onSelect('Female')}
      >
        <Text style={[styles.text, selected === 'Female' ? styles.textSelected : styles.textUnselected]}>
          {femaleText}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  button: {
    flex: 1,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  selected: {
    backgroundColor: colors.accent,
  },
  unselected: {
    backgroundColor: colors.card,
  },
  text: {
    fontSize: 16,
  },
  textSelected: {
    color: '#000000',
    fontWeight: 'bold',
  },
  textUnselected: {
    color: colors.textSecondary,
  },
});

export default GenderToggle;
