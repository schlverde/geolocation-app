import { ChangeDetectorRef, Component, inject } from '@angular/core';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonButton
} from '@ionic/angular'; // Ionic 9. (Ionic 8 or older: '@ionic/angular/standalone')
import { Geolocation } from '@capacitor/geolocation';
import * as L from 'leaflet';

interface Branch {
  name: string;
  latitude: number;
  longitude: number;
}

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardSubtitle,
    IonCardContent,
    IonButton
  ]
})
export class HomePage {
  // Needed so the screen updates after async work (Ionic 9 / zoneless Angular)
  private cdr = inject(ChangeDetectorRef);

  latitude: number | null = null;
  longitude: number | null = null;
  accuracy: number | null = null;

  loading = false;
  errorMessage = '';
  nearestBranch: { name: string; distance: string } | null = null;

  map!: L.Map;
  marker?: L.Marker;
  accuracyCircle?: L.Circle;

  // Starting map view (NOT the user's real location)
  private readonly defaultCenter: L.LatLngExpression = [14.5995, 120.9842];

  // Sample branches (change the coordinates to places near you)
  branches: Branch[] = [
    { name: 'Branch A', latitude: 14.5995, longitude: 120.9842 },
    { name: 'Branch B', latitude: 14.6042, longitude: 120.9822 },
    { name: 'Branch C', latitude: 14.5921, longitude: 120.9789 }
  ];

  // Emoji icon for branch markers (no image files needed)
  private readonly branchIcon = L.divIcon({
    html: '<div style="font-size:26px;line-height:26px;">🏪</div>',
    className: '',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -12]
  });

  // Emoji pin for the user's location
  private readonly userIcon = L.divIcon({
    html: '<div style="font-size:32px;line-height:32px;">📍</div>',
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -30]
  });

  ionViewDidEnter() {
    setTimeout(() => this.initializeMap(), 150);
  }

  initializeMap() {
    if (!this.map) {
      this.map = L.map('map').setView(this.defaultCenter, 13);

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(this.map);

      this.showBranches();
    }
    this.map.invalidateSize();
  }

  showBranches() {
    for (const branch of this.branches) {
      L.marker([branch.latitude, branch.longitude], { icon: this.branchIcon })
        .addTo(this.map)
        .bindPopup(`<strong>${branch.name}</strong>`);
    }
  }

  async getCurrentLocation() {
    this.loading = true;
    this.errorMessage = '';
    this.cdr.detectChanges();

    try {
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000
      });

      this.latitude = position.coords.latitude;
      this.longitude = position.coords.longitude;
      this.accuracy = Math.round(position.coords.accuracy);

      console.log('Latitude:', this.latitude);
      console.log('Longitude:', this.longitude);
      console.log('Accuracy:', this.accuracy);

      this.showLocationOnMap();
      this.findNearestBranch();
    } catch (error) {
      console.error('Unable to get location:', error);
      this.errorMessage =
        'Unable to retrieve your location. Please allow location permission, turn on location services, then try again.';
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  showLocationOnMap() {
    if (this.latitude === null || this.longitude === null || !this.map) {
      return;
    }

    const location: L.LatLngExpression = [this.latitude, this.longitude];
    this.map.setView(location, 17);

    this.marker?.remove();
    this.accuracyCircle?.remove();

    this.marker = L.marker(location, { icon: this.userIcon })
      .addTo(this.map)
      .bindPopup(
        `<strong>You are here!</strong><br>
         Latitude: ${this.latitude}<br>
         Longitude: ${this.longitude}`
      )
      .openPopup();

    if (this.accuracy !== null) {
      this.accuracyCircle = L.circle(location, {
        radius: this.accuracy,
        color: '#d4af37',
        fillColor: '#d4af37',
        fillOpacity: 0.15,
        weight: 1
      }).addTo(this.map);
    }
  }

  // Haversine formula (result in kilometers)
  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  findNearestBranch() {
    if (this.latitude === null || this.longitude === null) {
      return;
    }

    let nearest = this.branches[0];
    let shortest = this.calculateDistance(
      this.latitude, this.longitude, nearest.latitude, nearest.longitude
    );

    for (let i = 1; i < this.branches.length; i++) {
      const d = this.calculateDistance(
        this.latitude, this.longitude,
        this.branches[i].latitude, this.branches[i].longitude
      );
      if (d < shortest) {
        shortest = d;
        nearest = this.branches[i];
      }
    }

    this.nearestBranch = { name: nearest.name, distance: shortest.toFixed(2) };
    console.log('Nearest branch:', nearest.name, shortest.toFixed(2), 'km');
  }

  clearLocation() {
    this.latitude = null;
    this.longitude = null;
    this.accuracy = null;
    this.nearestBranch = null;
    this.errorMessage = '';

    this.marker?.remove();
    this.accuracyCircle?.remove();
    this.marker = undefined;
    this.accuracyCircle = undefined;

    if (this.map) {
      this.map.setView(this.defaultCenter, 13);
    }
    this.cdr.detectChanges();
  }
}
