import React, { useEffect, useState } from "react";
import { Image, View, Pressable, type ImageStyle } from "react-native";
import { useResource } from "./useResource";
import { imageRequest } from "./client";
import { resolveArtworkSource, imageDataUri } from "./artwork";
import { ReadError } from "./readPolicy";
import type { Project } from "./domain";
import { useTheme, Icon, Txt } from "./ui";
export function ProjectArtwork({
  project,
  width = 64,
  height = 86,
}: {
  project: Project;
  width?: number;
  height?: number;
}) {
  const c = useTheme();
  const [sourceError, setSourceError] = useState(false);
  const source = resolveArtworkSource(
    project.poster_file_id,
    project.poster_url,
  );
  useEffect(() => setSourceError(false), [source]);
  const resource = useResource(
    source
      ? "artwork:" + project.workspace_id + ":" + project.id + ":" + source
      : null,
    async (signal) => {
      if (!source) return null;
      if (source.startsWith("file:")) {
        const image = await imageRequest(
          "/functions/v1/files-download?fileId=" +
            encodeURIComponent(source.slice(5)),
          signal,
        );
        return imageDataUri(image.bytes, image.type);
      }
      // Public URL requests never receive the Bordero token or apikey.
      return source;
    },
  );
  const style: ImageStyle = {
    width,
    height,
    borderRadius: 12,
    backgroundColor: c.secondary,
  };
  return resource.data && !sourceError ? (
    <Image
      source={{ uri: resource.data }}
      resizeMode="contain"
      style={style}
      accessibilityLabel={"Affiche de " + project.name}
      onError={() => setSourceError(true)}
    />
  ) : (
    <Pressable
      accessibilityRole={resource.error ? "button" : undefined}
      accessibilityLabel={
        resource.error ? "Réessayer l’affiche de " + project.name : project.name
      }
      onPress={() => {
        setSourceError(false);
        resource.retry();
      }}
      disabled={!resource.error && !sourceError}
      style={[
        style,
        {
          justifyContent: "center",
          alignItems: "center",
          gap: 5,
          borderWidth: 1,
          borderColor: c.line,
        },
      ]}
    >
      <Icon
        name={
          resource.error || sourceError ? "refresh-outline" : "albums-outline"
        }
        size={25}
        color={c.muted}
      />
      {!!resource.error && (
        <Txt muted style={{ fontSize: 9, lineHeight: 12 }}>
          Réessayer
        </Txt>
      )}
    </Pressable>
  );
}
