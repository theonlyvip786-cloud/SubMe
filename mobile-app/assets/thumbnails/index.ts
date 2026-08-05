// Auto-generated thumbnail registry
// Each entry has: id (filename without ext), source (require), label

export type ThumbnailEntry = {
  id: string;
  source: any;
};

export const THUMBNAILS: ThumbnailEntry[] = [
  { id: '02eec4d64cb0f4d57accc63cf8e8c7b2', source: require('./02eec4d64cb0f4d57accc63cf8e8c7b2.jpg') },
  { id: '0eb294fc5543172d2e907cfd2fbc82e9', source: require('./0eb294fc5543172d2e907cfd2fbc82e9.jpg') },
  { id: '141626c4bc6a2db70fecc18f692fe001', source: require('./141626c4bc6a2db70fecc18f692fe001.jpg') },
  { id: '1bdfab1592893e116c0a0ffcf53d14ce', source: require('./1bdfab1592893e116c0a0ffcf53d14ce.jpg') },
  { id: '1d386ef644b04027350122d27420d8ea', source: require('./1d386ef644b04027350122d27420d8ea.jpg') },
  { id: '2ec585054bfe2b9a5e1cb06328f1eb56', source: require('./2ec585054bfe2b9a5e1cb06328f1eb56.jpg') },
  { id: '385c763d61707e05e1cbecd52187c05d', source: require('./385c763d61707e05e1cbecd52187c05d.jpg') },
  { id: '3eae4ee088219b43efe45c9100367c21', source: require('./3eae4ee088219b43efe45c9100367c21.jpg') },
  { id: '55e1add9bb115d0f629d77ed5e78a050', source: require('./55e1add9bb115d0f629d77ed5e78a050.jpg') },
  { id: '6f0547ade540f86ad1e49e1298583dc4', source: require('./6f0547ade540f86ad1e49e1298583dc4.jpg') },
  { id: '70da1d8a0383345701cebac1a29b4bb9', source: require('./70da1d8a0383345701cebac1a29b4bb9.jpg') },
  { id: '7362ba1a80e4de4f27aac7e6a1330e7d', source: require('./7362ba1a80e4de4f27aac7e6a1330e7d.jpg') },
  { id: '784c967237e290a21b641fc29ade3a5e', source: require('./784c967237e290a21b641fc29ade3a5e.jpg') },
  { id: '7b313a2398ca5b55be01085159c22209', source: require('./7b313a2398ca5b55be01085159c22209.jpg') },
  { id: '7e931317eb25088adde8de0a2e3ed95f', source: require('./7e931317eb25088adde8de0a2e3ed95f.jpg') },
  { id: '7f486e32e8ecd92beab5ed5cbefc27d6', source: require('./7f486e32e8ecd92beab5ed5cbefc27d6.jpg') },
  { id: '82aaf6c420b451eabf986efcecd8c0d3', source: require('./82aaf6c420b451eabf986efcecd8c0d3.jpg') },
  { id: '98b5423aea588b31674a566f388d00ed', source: require('./98b5423aea588b31674a566f388d00ed.jpg') },
  { id: '991bf0cada4af170a67a1ffa22ae3952', source: require('./991bf0cada4af170a67a1ffa22ae3952.jpg') },
  { id: 'a3d5788bc76f99ee56b6e1a1fdf08458', source: require('./a3d5788bc76f99ee56b6e1a1fdf08458.jpg') },
  { id: 'b68fdc79fb98e729a35f4efe9852dc09', source: require('./b68fdc79fb98e729a35f4efe9852dc09.jpg') },
  { id: 'ec326149e1cc2e7b303569fdd131368e', source: require('./ec326149e1cc2e7b303569fdd131368e.jpg') },
  { id: 'ee5e4805ac4d9ccfda77ed049fc67c1a', source: require('./ee5e4805ac4d9ccfda77ed049fc67c1a.jpg') },
  { id: 'faa39989711053e50ba6cdc0201ba164', source: require('./faa39989711053e50ba6cdc0201ba164.jpg') },
];

// Get the bundled source object by thumbnail id
export function getThumbnailSource(thumbnailId: string | null | undefined): any | null {
  if (!thumbnailId) return null;
  const entry = THUMBNAILS.find(t => t.id === thumbnailId);
  return entry ? entry.source : null;
}
