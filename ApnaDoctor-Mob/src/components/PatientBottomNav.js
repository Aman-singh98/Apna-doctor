import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TEAL = '#1A7E8A';

export default function PatientBottomNav({ activeTab }) {
   const router = useRouter();
   const insets = useSafeAreaInsets();

   const navItems = [
      { id: 'home', label: 'Home', icon: 'home', route: '/patient/dashboard' },
      { id: 'appointments', label: 'Appointments', icon: 'calendar', route: '/patient/appointments' },
      { id: 'records', label: 'Records', icon: 'document-text', route: '/patient/records' },
      { id: 'profile', label: 'Profile', icon: 'person', route: '/patient/profile' },
   ];

   const handlePress = (item) => {
      if (activeTab === item.id) return;
      router.replace(item.route);
   };

   return (
      <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 12) }]}>
         {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
               <TouchableOpacity
                  key={item.id}
                  style={styles.navItem}
                  onPress={() => handlePress(item)}
                  activeOpacity={0.8}
               >
                  <View style={[styles.iconContainer, isActive && styles.activeIconContainer]}>
                     <Ionicons
                        name={isActive ? item.icon : `${item.icon}-outline`}
                        size={22}
                        color={isActive ? TEAL : '#777'}
                     />
                  </View>
                  <Text style={[styles.navLabel, isActive && styles.activeNavLabel]}>
                     {item.label}
                  </Text>
               </TouchableOpacity>
            );
         })}
      </View>
   );
}

const styles = StyleSheet.create({
   container: {
      flexDirection: 'row',
      backgroundColor: '#ffffff',
      borderTopWidth: 1,
      borderTopColor: '#f0f0f0',
      paddingTop: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -3 },
      shadowOpacity: 0.05,
      shadowRadius: 5,
      elevation: 10,
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
   },
   navItem: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
   },
   iconContainer: {
      width: 44,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 3,
   },
   activeIconContainer: {
      backgroundColor: '#E8F5F7',
   },
   navLabel: {
      fontSize: 11,
      fontWeight: '500',
      color: '#777',
   },
   activeNavLabel: {
      color: TEAL,
      fontWeight: '600',
   },
});
