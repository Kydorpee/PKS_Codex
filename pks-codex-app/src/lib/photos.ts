import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

/** Lado da foto salva, em pixels. Pequena para caber no documento do Firestore. */
const PHOTO_SIZE = 256;

/**
 * Reduz a imagem e devolve como data URI (JPEG em base64). A foto fica guardada dentro do
 * próprio personagem/monstro, então aparece em todos os celulares do Codex.
 */
export async function toSharedPhoto(uri: string): Promise<string | undefined> {
  try {
    const context = ImageManipulator.manipulate(uri);
    context.resize({ width: PHOTO_SIZE, height: PHOTO_SIZE });
    const image = await context.renderAsync();
    const result = await image.saveAsync({ format: SaveFormat.JPEG, base64: true, compress: 0.6 });
    return result.base64 ? `data:image/jpeg;base64,${result.base64}` : undefined;
  } catch {
    return undefined;
  }
}

/** Abre a galeria e devolve a foto escolhida já reduzida. */
export async function pickPhoto(): Promise<string | undefined> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert('Permissão necessária', 'Permita o acesso às fotos para escolher uma imagem.');
    return undefined;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });
  if (result.canceled) return undefined;

  const photo = await toSharedPhoto(result.assets[0].uri);
  if (!photo) Alert.alert('Não foi possível usar a foto', 'Tente outra imagem.');
  return photo;
}
