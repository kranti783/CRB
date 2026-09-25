
// Cauvery Basin LULC Classification - 2016

var CauveryRiverBasin = ee.FeatureCollection(
  'YOUR_GEE_ASSET_PATH/CauveryRiverBasin'
);

var maskLandsat8 = function(image) {
  var qa = image.select('QA_PIXEL');

  var cloudShadow = 1 << 4;
  var cloud = 1 << 3;

  var mask = qa.bitwiseAnd(cloudShadow).eq(0)
    .and(qa.bitwiseAnd(cloud).eq(0));

  return image.updateMask(mask);
};

var landsat8 = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
  .filterBounds(CauveryRiverBasin)
  .filterDate('2016-01-01', '2016-12-31')
  .filter(ee.Filter.lt('CLOUD_COVER', 4))
  .map(maskLandsat8)
  .median()
  .clip(CauveryRiverBasin);

var bands = [
  'SR_B2',
  'SR_B3',
  'SR_B4',
  'SR_B5',
  'SR_B6',
  'SR_B7'
];

var label = 'Class';

var input = landsat8.select(bands);

// LULC reference samples
// Class 1 = Water Bodies
// Class 2 = Dense Forest
// Class 3 = Agricultural Land
// Class 4 = Moderate Forest
// Class 5 = Barren Land
// Class 6 = Built-up Area

var c1 = water_bodies.map(function(feature) {
  return feature.set(label, 1);
});

var c2 = Dense_forest.map(function(feature) {
  return feature.set(label, 2);
});

var c3 = Agricultural_land.map(function(feature) {
  return feature.set(label, 3);
});

var c4 = Moderate_forest.map(function(feature) {
  return feature.set(label, 4);
});

var c5 = Barren_land.map(function(feature) {
  return feature.set(label, 5);
});

var c6 = Builtup_area.map(function(feature) {
  return feature.set(label, 6);
});

var referenceSamples = c1
  .merge(c2)
  .merge(c3)
  .merge(c4)
  .merge(c5)
  .merge(c6);

var samples = input.sampleRegions({
  collection: referenceSamples,
  properties: [label],
  scale: 30,
  geometries: true
});

var split = samples.randomColumn('random', 42);

var training = split.filter(
  ee.Filter.lt('random', 0.7)
);

var validation = split.filter(
  ee.Filter.gte('random', 0.7)
);

var classifier = ee.Classifier.smileRandomForest(100).train({
  features: training,
  classProperty: label,
  inputProperties: bands
});

var classified = input.classify(classifier);