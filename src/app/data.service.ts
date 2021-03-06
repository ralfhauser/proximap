import {EventEmitter, Injectable, OnInit, Output} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {NgRedux, select} from '@angular-redux/store';
import {Feature, FeatureCollection, Point} from 'geojson';
import {IAppState, FountainSelector} from './store';
import {GET_DIRECTIONS_SUCCESS, SELECT_FOUNTAIN_SUCCESS, SELECT_PROPERTY} from './actions';

import distance from 'haversine';
import {environment} from '../environments/environment';
import {essenceOf, replaceFountain} from './database.service';
import {TranslateService} from '@ngx-translate/core';
import {versions as buildInfo} from '../environments/versions';
import {PropertyMetadataCollection} from './types';

@Injectable()
export class DataService {
  apiUrl = buildInfo.branch == 'stable' ? environment.apiUrlStable : environment.apiUrlBeta;
  private _currentFountainSelector: FountainSelector = null;
  private _fountainsAll: FeatureCollection<any> = null;
  private _fountainsFiltered: Array<any> = null;
  private _propertyMetadataCollection: PropertyMetadataCollection = null;
  private _locationInfo: any = null;
  @select() filterText;
  @select() filterCategories;
  @select() fountainId;
  @select() userLocation;
  @select() mode;
  @select('lang') lang$;
  @select('city') city$;
  @select('travelMode') travelMode$;
  @Output() fountainSelectedSuccess: EventEmitter<Feature<any>> = new EventEmitter<Feature<any>>();
  @Output() fountainsLoadedSuccess: EventEmitter<FeatureCollection<any>> = new EventEmitter<FeatureCollection<any>>();
  @Output() fountainsFilteredSuccess: EventEmitter<Array<string>> = new EventEmitter<Array<string>>();
  @Output() directionsLoadedSuccess: EventEmitter<object> = new EventEmitter<object>();
  @Output() fountainHighlightedEvent: EventEmitter<Feature<any>> = new EventEmitter<Feature<any>>();
  @Output() metadataLoaded: EventEmitter<boolean> = new EventEmitter<boolean>();


  // public observables used by external components
  get fountainsAll() {
    return this._fountainsAll;
  }

  get propMeta() {
    // todo: this souldn't return null if the api request is still pending
    return this._propertyMetadataCollection;
  }

  get locationInfo() {
    // todo: this souldn't return null if the api request is still pending
    return this._locationInfo;
  }
  constructor(private translate: TranslateService,
              private http: HttpClient,
              private ngRedux: NgRedux<IAppState>) {
    // Load metadata from server
    Promise.all([
      this.fetchPropertyMetadata(),
      this.fetchLocationMetadata()
    ])
      .then(()=>this.metadataLoaded.emit(true));

    // Subscribe to changes in application state
    this.userLocation.subscribe(() => {
      this.sortByProximity();
    });
    this.filterCategories.subscribe(() => {
      this.filterFountains();
    });
    this.mode.subscribe(mode => {
      if (mode == 'directions') {
        this.getDirections();
      }
    });
    this.lang$.subscribe(() => {
      if (this.ngRedux.getState().mode === 'directions') {
        this.getDirections();
      }
    });
    this.city$.subscribe(city => {
      this.loadCityData(city);
    });
    this.travelMode$.subscribe(() => {
      this.getDirections();
    });
  }

  getLocationBounds(city) {
      return new Promise((resolve, reject)=>{
        if(city!== null){
        const waiting = () => {
          if (this._locationInfo === null) {
            setTimeout(waiting, 200);
          } else {
            let bbox = this._locationInfo[city].bounding_box;
            resolve([[
              bbox.lngMin,
              bbox.latMin
            ], [
              bbox.lngMax,
              bbox.latMax
            ]])
          }
        };
        waiting();
        }else{
          reject('invalid city')
        }
      })
  }

  // fetch fountain property metadata
  fetchPropertyMetadata() {
    return new Promise((resolve, reject)=>{
      let metadataUrl = `${this.apiUrl}api/v1/metadata/fountain_properties`;
      this.http.get(metadataUrl)
        .subscribe(
          (data: PropertyMetadataCollection) => {
            this._propertyMetadataCollection = data;
            resolve(true)
          }, err=>{
            // if in development mode, show a message.
            if(!environment.production){
              alert(`Could not contact server. Make sure that the datablue server is running. Check the README for more information.`);
            }else{
              alert("Could not contact data server. Please excuse this inconvenience")
            }
            reject(err);
          }
        );
    })

  }

  // fetch location metadata
  fetchLocationMetadata() {
    return new Promise((resolve, reject)=> {
      let metadataUrl = `${this.apiUrl}api/v1/metadata/locations`;
      this.http.get(metadataUrl)
        .subscribe(
          (data: any) => {
            this._locationInfo = data;
            resolve(true)
          }, err => reject(err)
        );
    })
  }

  // Get the initial data
  loadCityData(city) {
    if (city !== null) {
      let fountainsUrl = `${this.apiUrl}api/v1/fountains?city=${city}`;
      this.http.get(fountainsUrl)
        .subscribe(
          (data: FeatureCollection<any>) => {
            this._fountainsAll = data;
            this.fountainsLoadedSuccess.emit(data);
            this.sortByProximity();
          }
        );
    }
  }

  // Filter fountains
  filterFountains() {
    let fCats = this.ngRedux.getState().filterCategories;
    if (this._fountainsAll !== null) {
      let filterText = this.normalize(fCats.filterText);
      this._fountainsFiltered = this._fountainsAll.features.filter(f => {
        let name = this.normalize(`${f.properties.name}_${f.properties.name_en}_${f.properties.name_fr}_${f.properties.name_de}_${f.properties.id_wikidata}_${f.properties.id_operator}_${f.properties.id_osm}`);
        let textOk = name.indexOf(filterText) > -1;
        let waterOk = !fCats.onlySpringwater || f.properties.water_type == 'springwater';
        let notableOk = !fCats.onlyNotable || f.properties.wikipedia_en_url !== null || f.properties.wikipedia_de_url !== null;
        let ageOk = fCats.onlyOlderThan === null || (f.properties.construction_date !== null && f.properties.construction_date <= fCats.onlyOlderThan);
        return textOk && waterOk && ageOk && notableOk;
      });
      this.fountainsFilteredSuccess.emit(this._fountainsFiltered);

      // If only one fountain is left, select it (wait a second because maybe the user is not done searching
      setTimeout(() => {
        if (this._fountainsFiltered.length === 1) {
          this.selectFountainByFeature(this._fountainsFiltered[0]);
        }
      }, 500);
    }
  }

  highlightFountain(fountain) {
    this.fountainHighlightedEvent.emit(fountain);
  }


  fountainFilter(fountain) {
    let filterText = this.normalize(this.filterText);
    let name = this.normalize(fountain.properties.name);
    let textOk = name.indexOf(filterText) > -1;
    let waterOk = !this.filterCategories.onlySpringwater || fountain.properties.water_type == 'springwater';
    let historicOk = !this.filterCategories.onlyHistoric || fountain.properties.name != 'Unnamed fountain';
    let ageOk = this.filterCategories.onlyOlderThan === null || (fountain.properties.construction_year !== null && fountain.properties.construction_year <= this.filterCategories.onlyOlderThan);
    return textOk && waterOk && ageOk && historicOk;
  }

  sortByProximity() {
    let location = this.ngRedux.getState().userLocation;
    if (this._fountainsAll !== null && location !== null) {
      this._fountainsAll.features.forEach(f => {
        f.properties['distanceFromUser'] = distance(f.geometry.coordinates, location, {
          format: '[lon,lat]',
          unit: 'km'
        });
      });
      this._fountainsAll.features.sort((f1, f2) => {
        return f1.properties.distanceFromUser - f2.properties.distanceFromUser;
      });
    }
    // redo filtering
    this.filterFountains();
  }

  selectFountainByFeature(fountain: Feature<any>) {
    let s: FountainSelector = {} as any;
    if (fountain.properties.id_wikidata !== null && fountain.properties.id_wikidata !== 'null') {
      s = {
        queryType: 'byId',
        database: 'wikidata',
        idval: fountain.properties.id_wikidata
      };
    } else if (fountain.properties.id_operator !== null && fountain.properties.id_operator !== 'null') {
      s = {
        queryType: 'byId',
        database: 'operator',
        idval: fountain.properties.id_operator
      };
    } else if (fountain.properties.id_osm !== null && fountain.properties.id_osm !== 'null') {
      s = {
        queryType: 'byId',
        database: 'osm',
        idval: fountain.properties.id_osm
      };
    } else {
      s = {
        queryType: 'byCoords',
        lat: fountain.geometry.coordinates[1],
        lng: fountain.geometry.coordinates[0],
        radius: 15
      };
    }
    this.selectFountainBySelector(s);
  }

  // Select fountain
  selectFountainBySelector(selector: FountainSelector, updateDatabase: boolean = false) {

    // only do selection if the same selection is not ongoing
    if (JSON.stringify(selector) !== JSON.stringify(this._currentFountainSelector)) {

      this._currentFountainSelector = selector;

      // create parameter string
      let params = '';
      for (let key in selector) {
        if (selector.hasOwnProperty(key)) {
          params += `${key}=${selector[key]}&`;
        }
      }
      if (selector !== null) {
        // use selector criteria to create api call
        let url = `${this.apiUrl}api/v1/fountain?${params}city=${this.ngRedux.getState().city}`;
        this.http.get(url)
          .subscribe((fountain: Feature<any>) => {
              if (fountain !== null) {
                this._currentFountainSelector = null;
                this.ngRedux.dispatch({type: SELECT_FOUNTAIN_SUCCESS, payload: {fountain: fountain, selector: selector}});

                if (updateDatabase) {
                  let fountain_simple = essenceOf(fountain, this._propertyMetadataCollection);
                  this._fountainsAll = replaceFountain(this.fountainsAll, fountain_simple);
                  this.fountainsLoadedSuccess.emit(this._fountainsAll);
                  this.sortByProximity();
                }
              }else{
                alert('URL invalid');
              }
            },
            error => console.log('error fetching latest data'));
      }
    }
  }

  // force Refresh of data for currently selected fountain
  forceRefresh(): any {
    let coords = this.ngRedux.getState().fountainSelected.geometry.coordinates;
    let selector: FountainSelector = {
      queryType: 'byCoords',
      lat: coords[1],
      lng: coords[0],
      radius: 15
    };

    this.selectFountainBySelector(selector, true);

  }

  getDirections() {
    //  get directions for current user location, fountain, and travel profile
    let s = this.ngRedux.getState();
    if (s.fountainSelected !== null) {
      if (s.userLocation === null) {
        this.translate.get('action.navigate_tooltip')
          .subscribe(alert);
        return;
      }
      let url = `https://api.mapbox.com/directions/v5/mapbox/${s.travelMode}/${s.userLocation[0]},${s.userLocation[1]};${s.fountainSelected.geometry.coordinates[0]},${s.fountainSelected.geometry.coordinates[1]}?access_token=${environment.mapboxApiKey}&geometries=geojson&steps=true&language=${s.lang}`;


      this.http.get(url)
        .subscribe(
          (data: FeatureCollection<any>) => {
            this.ngRedux.dispatch({type: GET_DIRECTIONS_SUCCESS, payload: data});
            this.directionsLoadedSuccess.emit(data);
          });
    }

  }


  normalize(string: string) {
    if (!string) {
      return '';
    } else {
      return string.trim().toLowerCase();
    }
  }
}


