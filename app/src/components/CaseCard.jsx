import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import colors from '../theme/colors';

const CaseCard = ({ title, date, status, onPress }) => {
  const getStatusStyle = (status) => {
    switch (status) {
      case 'Active':
        return {
          backgroundColor: '#C9A84C20',
          color: '#C9A84C',
          borderColor: '#C9A84C40',
        };
      case 'Pending':
        return {
          backgroundColor: '#FF980020',
          color: '#FF9800',
          borderColor: '#FF980040',
        };
      case 'Resolved':
        return {
          backgroundColor: '#4CAF5020',
          color: '#4CAF50',
          borderColor: '#4CAF5040',
        };
      default:
        return {
          backgroundColor: '#C9A84C20',
          color: '#C9A84C',
          borderColor: '#C9A84C40',
        };
    }
  };

  const statusStyle = getStatusStyle(status);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.leftContent}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.date}>{date}</Text>
      </View>
      <View style={[styles.statusBadge, { backgroundColor: statusStyle.backgroundColor, borderColor: statusStyle.borderColor }]}>
        <Text style={[styles.statusText, { color: statusStyle.color }]}>{status}</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftContent: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  date: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '500',
  },
});

export default CaseCard;
