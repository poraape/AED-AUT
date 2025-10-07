
import React from 'react';
import Spinner from './Spinner';

interface LoadingIndicatorProps {
    text: string;
}

const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({ text }) => {
    return (
        <div className="flex flex-col items-center justify-center h-full text-gray-300">
            <Spinner />
            <p className="mt-4 text-lg">{text}</p>
        </div>
    );
};

export default LoadingIndicator;
