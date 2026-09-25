
// Cauvery Basin LULC Classification - 2008

var CauveryRiverBasin = ee.FeatureCollection(
  'YOUR_GEE_ASSET_PATH/CauveryRiverBasin'
);

function fillGaps(image) {
  var filled1 = image.focal_mean(1, 'square', 'pixels', 5);
  var filled2 = image.focal_mean(2, 'square', 'pixels', 5);
  var filled3 = image.focal_mean(3, 'square', 'pixels', 5);

  return image
    .unmask(filled1)
    .unmask(filled2)
    .unmask(filled3);
}

var maskLandsat7 = function(image) {
  var qa = image.select('QA_PIXEL');

  var cloudShadow = 1 << 4;
  var cloud = 1 << 3;

  var mask = qa.bitwiseAnd(cloudShadow).eq(0)
    .and(qa.bitwiseAnd(cloud).eq(0));

  return image.updateMask(mask);
};

var l7_composite = ee.ImageCollection(
  'LANDSAT/LE07/C02/T1_L2'
)
  .filterDate('2008-01-01', '2008-12-31')
  .filterBounds(CauveryRiverBasin)
  .filter(ee.Filter.lt('CLOUD_COVER', 4))
  .map(maskLandsat7)
  .map(fillGaps)
  .median()
  .clip(CauveryRiverBasin);

var label = 'Class';

var bands = [
  'SR_B1',
  'SR_B2',
  'SR_B3',
  'SR_B4',
  'SR_B5',
  'SR_B7'
];

var input = l7_composite.select(bands);

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