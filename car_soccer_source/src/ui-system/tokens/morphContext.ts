import React from 'react';

/**
 * Context indicating whether a component is embedded within a MorphContainer.
 * Placed in tokens to decouple layout primitives from upper navigation layers.
 */
export const MorphContainerContext = React.createContext<boolean>(false);
export const useInMorphContainer = () => React.useContext(MorphContainerContext);
